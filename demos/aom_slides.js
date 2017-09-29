var slides;
var showAllSlidesButton;
var ignoreFocusEvents = false;

function $(element) {
  return document.getElementById(element);
}

function onSlideEnter() {
  console.log('onSlideEnter');
  window.setTimeout(function() {
    document.activeElement.blur();
    window.setTimeout(function() {
      var slideIndex = parseInt(location.hash.substr(1), 10) - 1;
      ignoreFocusEvents = true;
      slides[slideIndex].focus();
      console.log('onSlideEnter focus');
      window.setTimeout(function() {
        ignoreFocusEvents = false;
      }, 0);
    }, 600);
  }, 600);
}

function onFocus(e) {
  console.log('focus ' + e.target);
  document.pageXOffset = 0;
  if (ignoreFocusEvents) {
    console.log('ignore focus');
    return true;
  }
  var t = e.target;
  while (t && t.tagName != 'ARTICLE') {
    t = t.parentElement;
  }
  if (t) {
    var slideIndex = parseInt(t.getAttribute('slideIndex'), 10);
    if (curSlide != slideIndex) {
      console.log('Focus switch from ' +
                  (curSlide + 1) + ' to ' + (slideIndex + 1));
      curSlide = slideIndex;
      updateSlides();
      document.body.scrollLeft = 0;
    }
  }
  return true;
}

function onScroll(e) {
  console.log('scroll');
  document.body.scrollLeft = 0;
  e.preventDefault();
  return false;
}

// Called when the page loads.
function initAriaPreso() {
  slides = document.querySelectorAll('section.slides > article');

  for (var i = 0; i < slides.length; i++) {
    slides[i].setAttribute('tabindex', '-1');
    slides[i].setAttribute('slideIndex', i);

    var title = 'Slide ' + (i + 1);
    var heading = slides[i].querySelector('h1,h2,h3,h4,h5,h6');
    if (heading)
      title = heading.textContent + ' ' + title;

    slides[i].setAttribute('aria-label', title);
  }

  document.addEventListener('slideenter', onSlideEnter, true);
  document.addEventListener('focus', onFocus, true);
  document.addEventListener('scroll', onScroll, true);


  var aomEnabled = (document.body.accessibleNode != undefined);
  var nodes = document.querySelectorAll(".aom_enabled");
  for (var i = 0; i < nodes.length; i++)
    nodes[i].style.display = aomEnabled ? "block" : "none";
  nodes = document.querySelectorAll(".aom_disabled");
  for (var i = 0; i < nodes.length; i++)
    nodes[i].style.display = aomEnabled ? "none" : "block";
}

function refreshLiveCoding(basename) {
  var src = $(basename + '_src');
  var dst = $(basename + '_embed');
  var html = src.innerText;
  dst.innerHTML = html;
  if (window[basename + '_hook'])
    window[basename + '_hook']();
  return false;
}

function addLiveCodingEventListeners(basename, src) {
  src.addEventListener('keydown', function(e) {
    if (e.keyCode == 9)  // tab
      return true;
    window.setTimeout(function() {
      refreshLiveCoding(basename);
    }, 0);
    e.stopPropagation();
    return false;
  }, false);
  src.addEventListener('blur', function(e) {
    window.setTimeout(function() {
      prettyPrint();
    }, 0);
  }, false);
}

function generateOutput(basename) {
  var script = $(basename + '_script');
  var output = $(basename + '_output');
  output.innerHTML = '';
  var js = script.innerText;
  js = 'function print(str) {\n' +
       '  var o = document.createElement("xmp");\n' +
       '  o.innerText = str;\n' +
       '  $("' + basename + '_output").appendChild(o);' +
       '}' + js;
  try {
    eval(js);
  } catch (e) {
    output.innerText += e;
  }
  var run = document.createElement('button');
  run.className = 'run_again';
  run.style.marginTop = "1em";
  run.innerText = 'Run again';
  output.appendChild(run);
  run.addEventListener('click', function() {
    refreshLiveCoding(basename);
    generateOutput(basename);
  }, false);
  run.focus();
}

// Sync a contenteditable containing html with a div containing the result.
function manageLiveCoding(basename) {
  var src = $(basename + '_src');
  src.title = "HTML source";
  var code = src.innerHTML;
  if (code[0] == '\n')
    code = code.substr(1);
  code = code.replace(/\n\n/g, '\n');
  code = code.replace(/</g, '&lt;');
  code = code.replace(/>/g, '&gt;');
  src.innerHTML = code;

  refreshLiveCoding(basename);
  addLiveCodingEventListeners(basename, src);

  var output = $(basename + '_output');
  output.title = "JavaScript output";
  var run = document.createElement('button');
  run.className = 'run';
  run.innerText = 'Run';
  run.addEventListener('click', function() {
    generateOutput(basename);
  }, false);
  output.appendChild(run);

  $(basename + '_script').title = "JavaScript Source";
  $(basename + '_embed').title = "HTML Output";
}

// Override keys used by interactive controls so they don't move
// to the next slide.
function overrideKeys(e) {
  if (e.keyCode == 32 ||  // space
      e.keyCode == 13 ||  // return
      e.keyCode == 8 ||   // tab
      e.keyCode == 38 ||  // up-arrow
      e.keyCode == 40) {  // down-arrow
    e.stopPropagation();
  }
  var active = document.activeElement;
  if ((e.keyCode == 37 || e.keyCode == 39) &&  // left/right arrows
      active.getAttribute("contentEditable") != "") {
    e.stopPropagation();
  }
  return true;
}
