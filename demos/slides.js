/*
  Google I/O 2011 HTML slides template

  Authors: Luke Mahé (code)
           Marcin Wichary (code and design)
           Dominic Mazzoni (browser compatibility)

  URL: http://code.google.com/p/io-2011-slides/
*/

var SLIDE_CLASSES = ['far-past', 'past', 'current', 'next', 'far-next'];

var PM_TOUCH_SENSITIVITY = 15;

var curSlide;

/* ---------------------------------------------------------------------- */
/* classList polyfill by Eli Grey
 * (http://purl.eligrey.com/github/classList.js/blob/master/classList.js) */

if (typeof document !== "undefined" && !("classList" in document.createElement("a"))) {

(function (view) {

var
    classListProp = "classList"
  , protoProp = "prototype"
  , elemCtrProto = (view.HTMLElement || view.Element)[protoProp]
  , objCtr = Object
  , strTrim = String[protoProp].trim || function () {
    return this.replace(/^\s+|\s+$/g, "");
  }
  , arrIndexOf = Array[protoProp].indexOf || function (item) {
    for (var i = 0, len = this.length; i < len; i++) {
      if (i in this && this[i] === item) {
        return i;
      }
    }
    return -1;
  }
  // Vendors: please allow content code to instantiate DOMExceptions
  , DOMEx = function (type, message) {
    this.name = type;
    this.code = DOMException[type];
    this.message = message;
  }
  , checkTokenAndGetIndex = function (classList, token) {
    if (token === "") {
      throw new DOMEx(
          "SYNTAX_ERR"
        , "An invalid or illegal string was specified"
      );
    }
    if (/\s/.test(token)) {
      throw new DOMEx(
          "INVALID_CHARACTER_ERR"
        , "String contains an invalid character"
      );
    }
    return arrIndexOf.call(classList, token);
  }
  , ClassList = function (elem) {
    var
        trimmedClasses = strTrim.call(elem.className)
      , classes = trimmedClasses ? trimmedClasses.split(/\s+/) : []
    ;
    for (var i = 0, len = classes.length; i < len; i++) {
      this.push(classes[i]);
    }
    this._updateClassName = function () {
      elem.className = this.toString();
    };
  }
  , classListProto = ClassList[protoProp] = []
  , classListGetter = function () {
    return new ClassList(this);
  }
;
// Most DOMException implementations don't allow calling DOMException's toString()
// on non-DOMExceptions. Error's toString() is sufficient here.
DOMEx[protoProp] = Error[protoProp];
classListProto.item = function (i) {
  return this[i] || null;
};
classListProto.contains = function (token) {
  token += "";
  return checkTokenAndGetIndex(this, token) !== -1;
};
classListProto.add = function (token) {
  token += "";
  if (checkTokenAndGetIndex(this, token) === -1) {
    this.push(token);
    this._updateClassName();
  }
};
classListProto.remove = function (token) {
  token += "";
  var index = checkTokenAndGetIndex(this, token);
  if (index !== -1) {
    this.splice(index, 1);
    this._updateClassName();
  }
};
classListProto.toggle = function (token) {
  token += "";
  if (checkTokenAndGetIndex(this, token) === -1) {
    this.add(token);
  } else {
    this.remove(token);
  }
};
classListProto.toString = function () {
  return this.join(" ");
};

if (objCtr.defineProperty) {
  var classListPropDesc = {
      get: classListGetter
    , enumerable: true
    , configurable: true
  };
  try {
    objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
  } catch (ex) { // IE 8 doesn't support enumerable:true
    if (ex.number === -0x7FF5EC54) {
      classListPropDesc.enumerable = false;
      objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
    }
  }
} else if (objCtr[protoProp].__defineGetter__) {
  elemCtrProto.__defineGetter__(classListProp, classListGetter);
}

}(self));

}
/* ---------------------------------------------------------------------- */

/* Slide movement */

function getSlideEl(no) {
  if ((no < 0) || (no >= slideEls.length)) {
    return null;
  } else {
    return slideEls[no];
  }
};

function updateSlideClass(slideNo, className) {
  var el = getSlideEl(slideNo);

  if (!el) {
    return;
  }

  if (className) {
    el.classList.add(className);
  }

  for (var i in SLIDE_CLASSES) {
    if (className != SLIDE_CLASSES[i]) {
      el.classList.remove(SLIDE_CLASSES[i]);
    }
  }
};

function updateSlides() {
  document.body.focus();
  for (var i = 0; i < slideEls.length; i++) {
    var el = getSlideEl(i);
    if (!el) {
      return;
    }

    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('inert', 'true');

    switch (i) {
      case curSlide - 2:
        updateSlideClass(i, 'far-past');
        break;
      case curSlide - 1:
        updateSlideClass(i, 'past');
        break;
      case curSlide:
        updateSlideClass(i, 'current');
        break;
      case curSlide + 1:
        updateSlideClass(i, 'next');
        break;
      case curSlide + 2:
        updateSlideClass(i, 'far-next');
        break;
      default:
        updateSlideClass(i);
        break;
    }
  }

  triggerLeaveEvent(curSlide - 1);
  triggerEnterEvent(curSlide);

  window.setTimeout(function() {
    // Hide after the slide
    disableSlideFrames(curSlide - 2);
  }, 301);

  enableSlideFrames(curSlide - 1);
  enableSlideFrames(curSlide + 1);
  enableSlideFrames(curSlide + 2);

  updateHash();
};

function buildNextItem() {
  var toBuild  = slideEls[curSlide].querySelectorAll('.to-build');

  if (!toBuild.length) {
    return false;
  }

  toBuild[0].classList.remove('to-build');

  return true;
};

function prevSlide() {
  if (curSlide > 0) {
    curSlide--;

    updateSlides();
  }
};

function nextSlide() {
  console.log('nextSlide');
  if (buildNextItem()) {
    console.log('did build next item');
    return;
  }

  if (curSlide < slideEls.length - 1) {
    console.log('updating slides');
    curSlide++;

    updateSlides();
  }
};

/* Slide events */

function triggerEnterEvent(no) {
  var el = getSlideEl(no);
  if (!el) {
    return;
  }

  var onEnter = el.getAttribute('onslideenter');
  if (onEnter) {
    new Function(onEnter).call(el);
  }

  var evt = document.createEvent('Event');
  evt.initEvent('slideenter', true, true);
  evt.slideNumber = no + 1; // Make it readable

  el.dispatchEvent(evt);
};

function triggerLeaveEvent(no) {
  var el = getSlideEl(no);
  if (!el) {
    return;
  }

  var onLeave = el.getAttribute('onslideleave');
  if (onLeave) {
    new Function(onLeave).call(el);
  }

  var evt = document.createEvent('Event');
  evt.initEvent('slideleave', true, true);
  evt.slideNumber = no + 1; // Make it readable

  el.dispatchEvent(evt);
};

/* Touch events */

function handleTouchStart(event) {
  if (event.touches.length == 1) {
    touchDX = 0;
    touchDY = 0;

    touchStartX = event.touches[0].pageX;
    touchStartY = event.touches[0].pageY;

    document.body.addEventListener('touchmove', handleTouchMove, true);
    document.body.addEventListener('touchend', handleTouchEnd, true);
  }
};

function handleTouchMove(event) {
  if (event.touches.length > 1) {
    cancelTouch();
  } else {
    touchDX = event.touches[0].pageX - touchStartX;
    touchDY = event.touches[0].pageY - touchStartY;
  }
};

function handleTouchEnd(event) {
  var dx = Math.abs(touchDX);
  var dy = Math.abs(touchDY);

  if ((dx > PM_TOUCH_SENSITIVITY) && (dy < (dx * 2 / 3))) {
    if (touchDX > 0) {
      prevSlide();
    } else {
      nextSlide();
    }
  }

  cancelTouch();
};

function cancelTouch() {
  document.body.removeEventListener('touchmove', handleTouchMove, true);
  document.body.removeEventListener('touchend', handleTouchEnd, true);
};

/* Preloading frames */

function disableSlideFrames(no) {
  var el = getSlideEl(no);
  if (!el) {
    return;
  }

  var frames = el.getElementsByTagName('iframe');
  for (var i = 0, frame; frame = frames[i]; i++) {
    disableFrame(frame);
  }
};

function enableSlideFrames(no) {
  var el = getSlideEl(no);
  if (!el) {
    return;
  }

  var frames = el.getElementsByTagName('iframe');
  for (var i = 0, frame; frame = frames[i]; i++) {
    enableFrame(frame);
  }
};

function disableFrame(frame) {
  frame.src = 'about:blank';
};

function enableFrame(frame) {
  var src = frame._src;
  if (src && frame.src != src) {
    frame.src = src;
  }
};

function setupFrames() {
  var frames = document.querySelectorAll('iframe');
  for (var i = 0, frame; frame = frames[i]; i++) {
    frame._src = frame.src;
    disableFrame(frame);
  }

  enableSlideFrames(curSlide - 1);
  enableSlideFrames(curSlide);
  enableSlideFrames(curSlide + 1);
  enableSlideFrames(curSlide + 2);
};

function makeCurrentSlideAccessible() {
  console.log('makeCurrentSlideAccessible 0');
  var el = getSlideEl(curSlide);
  if (!el) {
    return;
  }
  el.removeAttribute('aria-hidden');
  el.removeAttribute('inert');
  el.setAttribute('tabIndex', '-1');
  el.focus();
  window.setTimeout(function() {
    el.removeAttribute('tabIndex');
  }, 100);
}

function handleTransitionEnd(event) {
  if (!event.target.classList.contains('current')) {
    return;
  }

  makeCurrentSlideAccessible();
}

function setupInteraction() {
  /* Clicking and tapping */

  var slides = document.querySelector('section.slides');

  var el = document.createElement('button');
  el.innerHTML = '&#x2190;';
  el.className = 'slide-area';
  el.setAttribute('aria-label', 'Previous Slide');
  el.id = 'prev-slide-area';
  el.addEventListener('click', prevSlide, false);
  slides.insertBefore(el, slides.firstElementChild);

  el = document.createElement('button');
  el.className = 'slide-area';
  el.innerHTML = '&#x2192;';
  el.setAttribute('aria-label', 'Next Slide');
  el.id = 'next-slide-area';
  el.addEventListener('click', nextSlide, false);
  slides.appendChild(el);

  /* Swiping */

  document.body.addEventListener('touchstart', handleTouchStart, false);

  /* Transition end */

  document.body.addEventListener('webkitTransitionEnd', handleTransitionEnd, true);
}

/* Hash functions */

function getCurSlideFromHash() {
  var slideNo = parseInt(location.hash.substr(1));

  if (slideNo) {
    curSlide = slideNo - 1;
  } else {
    curSlide = 0;
  }
};

function updateHash() {
  location.replace('#' + (curSlide + 1));
};

/* Event listeners */

function handleBodyKeyDown(event) {
  switch (event.keyCode) {
    case 39: // right arrow
    case 13: // Enter
    case 32: // space
    case 34: // PgDn
      nextSlide();
      event.preventDefault();
      break;

    case 37: // left arrow
    case 8: // Backspace
    case 33: // PgUp
      prevSlide();
      event.preventDefault();
      break;

    case 40: // down arrow
      nextSlide();
      event.preventDefault();
      break;

    case 38: // up arrow
      prevSlide();
      event.preventDefault();
      break;
  }
};

function addEventListeners() {
  document.addEventListener('keydown', handleBodyKeyDown, false);
};

/* Initialization */

function addPrettify() {
  var els = document.querySelectorAll('pre');
  for (var i = 0, el; el = els[i]; i++) {
    var text = el.innerHTML;

    // Remove leading and trailing whitespace of any kind.
    text = text.replace(/^\s+|\s+$/g, '');

    // Figure out how many spaces of indentation are at the
    // beginning of every line (ignoring lines with 0 indentation).
    var lines = text.split('\n');
    var prefix_len = 999;
    for (var j = 0; j < lines.length; j++) {
      var match = lines[j].match(/^\s+/);
      if (match) {
        var pre = match[0].length;
        if (pre > 0 && pre < prefix_len)
          prefix_len = pre;
      }
    }

    if (prefix_len > 0 && prefix_len < 999) {
      // Remove that many spaces from the beginning of every line.
      var prefix = '';
      for (var j = 0; j < prefix_len; j++) {
        prefix += ' ';
      }
      var prefixPattern = new RegExp('\n' + prefix, 'g');
      text = text.replace(prefixPattern, '\n');
    }

    // Escape < and > characters.
    text = text.replace(/</g, '&lt;');
    text = text.replace(/>/g, '&gt;');

    // Rewrite the <pre> element.
    el.innerHTML = text;

    if (!el.classList.contains('noprettyprint')) {
      el.classList.add('prettyprint');
    }
  }

  var el = document.createElement('script');
  el.type = 'text/javascript';
  el.src = 'prettify.js';
  el.onload = function() {
    prettyPrint();
  }
  document.body.appendChild(el);
};

function addFontStyle() {
  var el = document.createElement('link');
  el.rel = 'stylesheet';
  el.type = 'text/css';
  el.href = 'https://fonts.googleapis.com/css?family=' +
            'Open+Sans:regular,semibold,italic,italicsemibold|Droid+Sans+Mono';

  document.body.appendChild(el);
};

function addGeneralStyle() {
  var el = document.createElement('link');
  el.rel = 'stylesheet';
  el.type = 'text/css';
  el.href = 'styles.css';
  document.body.appendChild(el);

  var el = document.createElement('meta');
  el.name = 'viewport';
  el.content = 'width=1100,height=750';
  document.querySelector('head').appendChild(el);

  var el = document.createElement('meta');
  el.name = 'apple-mobile-web-app-capable';
  el.content = 'yes';
  document.querySelector('head').appendChild(el);
};

function makeBuildLists() {
  for (var i = curSlide, slide; slide = slideEls[i]; i++) {
    var items = slide.querySelectorAll('.build > *');
    for (var j = 0, item; item = items[j]; j++) {
      if (item.classList) {
        item.classList.add('to-build');
      }
    }
  }
};

function handleDomLoaded() {
  slideEls = document.querySelectorAll('section.slides > article');

  addFontStyle();
  addGeneralStyle();
  addPrettify();
  addEventListeners();

  updateSlides();

  setupInteraction();
  setupFrames();
  makeBuildLists();

  document.body.classList.add('loaded');

  makeCurrentSlideAccessible();
};

function initialize() {
  getCurSlideFromHash();

  document.addEventListener('DOMContentLoaded', handleDomLoaded, false);
}

initialize();
