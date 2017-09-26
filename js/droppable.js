(function($) {
  "use strict";
  $.fn.droppable = function(optsOrFn, MaybeFn) {
    let opts = {};
    let cb;
    if (typeof(optsOrFn) == "function") {
      cb = optsOrFn;
    } else {
      opts = $.extend({}, opts, optsOrFn);
      cb = MaybeFn;
    }
    return this.each(function(){
      $(this).on('drop', (event) => {
        event.stopPropagation();
        event.preventDefault();
        let file = event.originalEvent.dataTransfer.files[0];
        $(this).css('background-color', '#FFFFFF');
        cb(file);
      });
      $(this).on('dragover', (event) => {
        event.stopPropagation();
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = 'copy';
      });
      $(this).on('dragenter', (event) => {
        $(this).css('background-color', '#F0F0F0');
      });
      $(this).on('dragleave', (event) => {
        $(this).css('background-color', '#FFFFFF');
      });
    });
  }
})(jQuery);
