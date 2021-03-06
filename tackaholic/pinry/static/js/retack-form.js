/**
 * Tack Form for Pinry
 * Descrip: This is for creation new tacks on everything, the bookmarklet, on the
 *          site and even editing tacks in some limited situations.
 * Authors: Pinry Contributors
 * Updated: March 3rd, 2013
 * Require: jQuery, Pinry JavaScript Helpers
 */


$(window).load(function() {
    var uploadedImage = false;
    var editedTack = null;

    // Start Helper Functions
    function getFormData() {
        return {
            submitter: currentUser,
            url: $('#retack-form-image-url').val(),
            description: $('#retack-form-description').val(),
            tags: cleanTags($('#retack-form-tags').val())
        }
    }

    function createRetackPreviewFromForm() {
        var context = {tacks: [{
                submitter: currentUser,
                image: {thumbnail: {image: $('#retack-form-image-url').val()}},
                description: $('#retack-form-description').val(),
                tags: cleanTags($('#retack-form-tags').val())
            }]},
            html = renderTemplate('#tacks-template', context),
            preview = $('#retack-form-image-preview');
        preview.html(html);
        preview.find('.tack').width(240);
        preview.find('.tack').fadeIn(300);
        if (getFormData().url == "")
            preview.find('.image-wrapper').height(255);
        preview.find('.image-wrapper img').fadeIn(300);
        setTimeout(function() {
            if (preview.find('.tack').height() > 305) {
                $('#retack-form .modal-body').animate({
                    'height': preview.find('.tack').height()+25
                }, 300);
            }
        }, 300);
    }

    function dismissModal(modal) {
        modal.modal('hide');

        setTimeout(function() {
            modal.remove();
            $('.modal-backdrop').remove();
            $('body').removeClass('modal-open');
        }, 200);
    }
    // End Helper Functions


    // Start View Functions
    function createRetackForm(editTackId) {

        var promise = getBoardListData(currentUser.id);
        promise.success(function(data) {
            $('body').append(renderTemplate('#retack-form-template', {boards: data.objects}));
        });

        var modal = $('#retack-form'),
            formFields = [$('#retack-form-image-url'), $('#retack-form-description'),
            $('#retack-form-tags')],
            retackFromUrl = getUrlParameter('retack-image-url');
        // If editable grab existing data

        $('#retack-form h3.modal-title').text('Re Tack');

        if (editTackId) {
            $('#retack-form h3.modal-title').text('Edit Tack');

            promise = getTackData(editTackId);
            promise.success(function(data) {
                editedTack = data;
                $('#retack-form-image-url').attr('data-id',data.image.id);
                $('#retack-form-image-url').val(editedTack.image.thumbnail.image);
                $('#retack-form-image-url').parent().hide();
                $('#retack-form-image-upload').parent().hide();
                $('#retack-form-board').val(editedTack.board.id);
                $('#retack-form-description').val(editedTack.description);
                $('#retack-form-tags').val(editedTack.tags);
                createRetackPreviewFromForm();
            });
        }
        modal.modal('show');
        // Auto update preview on field changes
        var timer;
        for (var i in formFields) {
            formFields[i].bind('propertychange keyup input paste', function() {
                clearTimeout(timer);
                timer = setTimeout(function() {
                    createRetackPreviewFromForm()
                }, 700);
                if (!uploadedImage)
                    $('#retack-form-image-upload').parent().fadeOut(300);
            });
        }
        // Drag and Drop Upload
        $('#retack-form-image-upload').fineUploader({
            request: {
                endpoint: '/tacks/create-image/',
                paramsInBody: true,
                multiple: false,
                validation: {
                    allowedExtensions: ['jpeg', 'jpg', 'png', 'gif']
                },
                text: {
                    uploadButton: 'Click or Drop'
                }
            }
        }).on('complete', function(e, id, name, data) {
            $('#retack-form-image-url').parent().fadeOut(300);
            $('.qq-upload-button').css('display', 'none');
            var promise = getImageData(data.success.id);
            uploadedImage = data.success.id;
            promise.success(function(image) {
                $('#retack-form-image-url').val(image.thumbnail.image);
                createRetackPreviewFromForm();
            });
            promise.error(function() {
                message('Problem uploading image.', 'alert alert-warning');
            });
        });
        // If bookmarklet submit
        if (retackFromUrl) {
            $('#retack-form-image-upload').parent().css('display', 'none');
            $('#retack-form-image-url').val(retackFromUrl);
            $('.navbar').css('display', 'none');
            modal.css({
                'margin-top': -35,
                'margin-left': -281
            });
        }
        // Submit tack on post click
        $('#retack-form-submit').click(function(e) {
            e.preventDefault();
            $(this).off('click');
            $(this).addClass('disabled');
            if (false) {
            //if (editedTack) {
                var apiUrl = '/api/v1/tack/'+editedTack.id+'/?format=json';
                var data = {
                    board: '/api/v1/user/'+$('#retack-form-board').val()+'/',
                    description: $('#retack-form-description').val(),
                    tags: cleanTags($('#retack-form-tags').val())
                };
                var promise = $.ajax({
                    type: "put",
                    url: apiUrl,
                    contentType: 'application/json',
                    data: JSON.stringify(data)
                });
                promise.success(function(tack) {
                    tack.editable = true;
                    var renderedTack = renderTemplate('#tacks-template', {
                        tacks: [
                            tack
                        ]
                    });
                    $('#tacks').find('.tack[data-id="'+tack.id+'"]').replaceWith(renderedTack);
                    tileLayout('tacks', 'tack');
                    lightbox();
                    dismissModal(modal);
                    editedTack = null;
                    message('New tack added, please refresh to see it.', 'alert alert-success');
                });
                promise.error(function() {
                    message('Problem updating image.', 'alert alert-warning');
                });
            } else {
                var data = {
                    submitter: '/api/v1/user/'+currentUser.id+'/',
                    description: $('#retack-form-description').val(),
                    board: '/api/v1/user/'+$('#retack-form-board').val()+'/',
                    tags: cleanTags($('#retack-form-tags').val())
                };
                //if (uploadedImage) data.image = '/api/v1/image/'+uploadedImage+'/';
                data.image = '/api/v1/image/' + $('#retack-form-image-url').attr('data-id') + '/';
                //else
                //data.url = $('#retack-form-image-url').val();
                var promise = postTackData(data);
                promise.success(function(tack) {
                    if (retackFromUrl) return window.close();
                    tack.editable = true;
                    tack = renderTemplate('#tacks-template', {tacks: [tack]});
                    $('#tacks').prepend(tack);
                    tileLayout('tacks', 'tack');
                    lightbox();
                    dismissModal(modal);
                    uploadedImage = false;
                });
                promise.error(function() {
                    message('Problem saving image.', 'alert alert-warning');
                });
            }
        });
        $('#retack-form-close').click(function() {
            if (retackFromUrl) return window.close();
            dismissModal(modal);
        });
        createRetackPreviewFromForm();
    }
    // End View Functions


    // Start Init
    window.retackForm = function(editTackId) {
        editTackId = typeof editTackId !== 'undefined' ? editTackId : null;
        createRetackForm(editTackId);
    }

    //if (getUrlParameter('retack-image-url')) {
    //    createRetackForm();
    //}
    // End Init
});
