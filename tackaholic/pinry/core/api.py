from tastypie import fields
from tastypie.authorization import DjangoAuthorization
from tastypie.constants import ALL, ALL_WITH_RELATIONS
from tastypie.exceptions import Unauthorized
from tastypie.resources import ModelResource
from django_images.models import Thumbnail

from .models import Tack, Image, Board, Category, Following
from ..users.models import User


class PinryAuthorization(DjangoAuthorization):
    """
    Pinry-specific Authorization backend with object-level permission checking.
    """
    def update_detail(self, object_list, bundle):
        klass = self.base_checks(bundle.request, bundle.obj.__class__)

        if klass is False:
            raise Unauthorized("You are not allowed to access that resource.")

        permission = '%s.change_%s' % (klass._meta.app_label, klass._meta.module_name)

        if not bundle.request.user.has_perm(permission, bundle.obj):
            raise Unauthorized("You are not allowed to access that resource.")

        return True

    def delete_detail(self, object_list, bundle):
        klass = self.base_checks(bundle.request, bundle.obj.__class__)

        if klass is False:
            raise Unauthorized("You are not allowed to access that resource.")

        permission = '%s.delete_%s' % (klass._meta.app_label, klass._meta.module_name)

        if not bundle.request.user.has_perm(permission, bundle.obj):
            raise Unauthorized("You are not allowed to access that resource.")

        return True


class UserResource(ModelResource):
    gravatar = fields.CharField(readonly=True)

    def dehydrate_gravatar(self, bundle):
        return bundle.obj.gravatar

    class Meta:
        list_allowed_methods = ['get']
        filtering = {
            'username': ALL,
            'id': ALL_WITH_RELATIONS,
        }
        queryset = User.objects.all()
        resource_name = 'user'
        fields = ['username', 'id']
        include_resource_uri = False


def filter_generator_for(size):
    def wrapped_func(bundle, **kwargs):
        return bundle.obj.get_by_size(size)
    return wrapped_func


class ThumbnailResource(ModelResource):
    class Meta:
        list_allowed_methods = ['get']
        fields = ['image', 'width', 'height']
        queryset = Thumbnail.objects.all()
        resource_name = 'thumbnail'
        include_resource_uri = False


class ImageResource(ModelResource):
    standard = fields.ToOneField(ThumbnailResource, full=True,
                                 attribute=lambda bundle: filter_generator_for('standard')(bundle))
    thumbnail = fields.ToOneField(ThumbnailResource, full=True,
                                  attribute=lambda bundle: filter_generator_for('thumbnail')(bundle))
    square = fields.ToOneField(ThumbnailResource, full=True,
                               attribute=lambda bundle: filter_generator_for('square')(bundle))

    class Meta:
        fields = ['image', 'width', 'height', 'id']
        include_resource_uri = False
        resource_name = 'image'
        queryset = Image.objects.all()
        authorization = DjangoAuthorization()

class BoardResource(ModelResource):
    owner = fields.ToOneField(UserResource, 'owner', full=True)
    cover = fields.ToOneField(ImageResource, 'cover', full=True)

    class Meta:
        ordering = ['id', 'name']
        filtering = {
            'owner': ALL_WITH_RELATIONS,
            'id': ALL_WITH_RELATIONS,
            'category': ALL_WITH_RELATIONS,
        }
        queryset = Board.objects.all()
        resource_name = 'board'
        include_resource_uri = False
        always_return_data = True
        authorization = DjangoAuthorization()

class TackResource(ModelResource):
    submitter = fields.ToOneField(UserResource, 'submitter', full=True)
    board = fields.ToOneField(BoardResource, 'board', full=True)
    image = fields.ToOneField(ImageResource, 'image', full=True)
    tags = fields.ListField()

    def hydrate_image(self, bundle):
        url = bundle.data.get('url', None)
        if url:
            image = Image.objects.create_for_url(url)
            bundle.data['image'] = '/api/v1/image/{}/'.format(image.pk)
        return bundle

    def hydrate(self, bundle):
        """Run some early/generic processing

        Make sure that user is authorized to create Pins first, before
        we hydrate the Image resource, creating the Image object in process
        """
        submitter = bundle.data.get('submitter', None)
        if not submitter:
            bundle.data['submitter'] = '/api/v1/user/{}/'.format(bundle.request.user.pk)
        else:
            if not '/api/v1/user/{}/'.format(bundle.request.user.pk) == submitter:
                raise Unauthorized("You are not authorized to create Tacks for other users")
        return bundle

    def dehydrate_tags(self, bundle):
        return map(str, bundle.obj.tags.all())

    def build_filters(self, filters=None):
        orm_filters = super(TackResource, self).build_filters(filters)
        if filters and 'tag' in filters:
            orm_filters['tags__name__in'] = filters['tag'].split(',')
        return orm_filters

    def save_m2m(self, bundle):
        tags = bundle.data.get('tags', None)
        if tags:
            bundle.obj.tags.set(*tags)
        return super(TackResource, self).save_m2m(bundle)

    class Meta:
        fields = ['id', 'url', 'origin', 'description']
        ordering = ['id']
        filtering = {
            'submitter': ALL_WITH_RELATIONS,
            'board': ALL_WITH_RELATIONS
        }
        queryset = Tack.objects.all()
        resource_name = 'tack'
        include_resource_uri = False
        always_return_data = True
        authorization = PinryAuthorization()

class CategoryResource(ModelResource):
    class Meta:
        ordering = ['name']
        queryset = Category.objects.all()
        filtering = {
            'name': ALL
        }
        resource_name = 'category'
        include_resource_uri = False

class FollowingResource(ModelResource):
    user = fields.ToOneField(UserResource, 'user', full=True)
    board = fields.ToOneField(BoardResource, 'board', full=True)

    class Meta:
        ordering = ['id']
        queryset = Following.objects.all()
        filtering = {
            'user': ALL_WITH_RELATIONS,
            'board': ALL_WITH_RELATIONS
        }
        resource_name = 'following'
        include_resource_uri = False
        authorization = DjangoAuthorization()