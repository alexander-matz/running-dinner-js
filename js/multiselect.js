(function($) {
  "use strict";
  let docListeners = {};
  // items: [title, value, default]
  $.fn.dropdownmulti = function(items, options) {
    return this.each(() => {
      let elem = $(this);
      let menu = $('<div>').addClass('dropdownmulti-menu');
      let choices = {};
      let onChanged = options.onChanged;
      let onOpen = options.onOpen;
      let onClose = options.onClose;
      let visible = false;

      function onItemClick(e) {
        e.stopPropagation();
      }

      function onCheckboxClick(e) {
        e.preventDefault();
        return false;
      }

      for (let i = 0; i < items.length; ++i) {
        let [title, value, def] = items[i];
        let item = $('<div>').addClass('dropdownmulti-item');
        let checkbox = $('<input>').attr('type', 'checkbox').addClass('dropdownmulti-checkbox');
        let text = $('<span>').addClass('dropdownmulti-text').text(title);
        // enforce boolean value
        def = (def ? true : false);
        choices[value] = def;
        checkbox.prop('checked', def);
        item.append(checkbox);
        item.append(text);
        menu.append(item);
        checkbox.on('focus', (e) => {
          checkbox.blur();
        })
        checkbox.on('click', (e) => {
          checkbox.prop('checked', !checkbox.prop('checked'));
        });
        item.on('click', (e) => {
          e.stopPropagation();
          let checked = !checkbox.prop('checked');
          checkbox.prop('checked', checked);
          choices[value] = checked;
          if (onChanged) onChanged(choices);
        });
      }
      menu.css({
        'display': 'none',
        'position': 'absolute',
        'z-index': 999,
      });

      function show() {
        elem.parent().append(menu);
        let {left, top} = elem.position();
        top += elem.height();
        menu.css({
          'display': 'block',
          'left': left + 'px',
          'top': top + 'px',
        });
        visible = true;
        if (onOpen) onOpen();
      }

      function hide() {
        menu.css('display', 'none');
        visible = false;
        if (onClose) onClose(choices);
      }

      $(document).on('click', (e) => {
        if (!visible) return;
        hide();
      });

      elem.on('click', (e) => {
        if (visible) return;
        e.preventDefault();
        e.stopPropagation();
        show();
      });
    });
  }
}
)(jQuery);
