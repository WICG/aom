## Background: assistive technology and the accessibility tree

Assistive technology, in this context, refers to a third party application
which augments or replaces the existing UI for an application.
One well-known example is a screen reader,
which replaces the visual UI and pointer-based UI
with an auditory output (speech and tones)
and a keyboard and/or gesture-based input mechanism,
completely separate from any audio output or keyboard or gesture input handled by the app.

Many assistive technologies interact with a web page via accessibility APIs, such as
[UIAutomation](https://msdn.microsoft.com/en-us/library/windows/desktop/ee684009.aspx)
on Windows, or
[NSAccessibility](https://developer.apple.com/library/mac/documentation/AppKit/Reference/NSAccessibility_Protocol_Reference/)
on OS X.
These APIs allow an application to expose a tree of objects representing the application's interface,
typically with the root node representing the application window,
with various levels of grouping node descendants down to individual interactive elements.

An assistive technology user interacts with the application almost exclusively via this API,
as the assistive technology uses it both to create the alternative interface,
and to route user interaction events triggered by the user's commands to the assistive technology.

For example, a [VoiceOver](https://www.apple.com/voiceover/info/guide/) user might press the key combination
"Control Option Spacebar" to indicate that they wish to click the element which the screen reader is currently visiting.
These keypresses would never be passed to the application,
but would be interpreted by the screen reader,
which would then call the `accessibilityPerformPress()` function on the element via the API.
This is then routed back to the DOM as a `click` event by the browser.

## Accessibility on the web platform today

The web has rich support for making applications accessible, but only via a *declarative* API.

Talk about options for making something accessible: either limit yourself to native elements
that are already accessible, or use ARIA to make custom elements behave the same. However,
there's essentially a one-to-one correspondence between the DOM and the accessibility tree
presented to assistive technology.

This is different than the situation on virtuall all native platforms. When writing a native
app for a desktop or mobile operating system, there are *low-level* accessibliity APIs that
make it possible to customize exactly how the application interfaces with assistive technology.

Note that native platforms often have *high-level* accessibility APIs, too - just like the
web platform provides. Changing the accessible text label for an image is often just a
single line of code and doesn't require subclassing. However, when the high-level APIs are
insufficient, the low-level APIs give the developer total control over optimizing the
accessible experience.

Since the web is missing this low-level API, it leads to significant gaps:

* Web apps that push the boundaries of what's possible on the web struggle to make them
  accessible because the APIs aren't yet sufficient.
* New web platform features aren't fully accessible or don't interact well with existing
  accessibility APIs, forcing developers to choose between using new standard or
  remaining accessible.

A low-level API would bridge that gap, allowing authors to bypass artificial limitations
or bugs in the platform and provide a custom accessible experience where necessary.

Note that we don't expect or encourage the average web developer to want or need
a low-level accessibility API for most things. Most of the time, declarative markup
works great. However, the impact should not be underestimated. A small number of
developers maintain the JavaScript frameworks and widget libraries that power the
vast majority of web apps, and accessibility is a key goal of most of these frameworks
and libraries. A low-level API would allow them to work around bugs and limitations
and provide a clean high-level interface for developers that "just works".

## Use cases

### Use DOM node references instead of IDREFs
Some HTML and ARIA features require reference to another element by IDREF,
but it's problematic in some contexts to require the accessibility code to generate IDs.
For example, some JS frameworks generated IDs automatically
and make maintaining the value of those IDs purposefully obtuse.
Likewise, in some extremes cases,
the expectation of IDREFs requires generating thousands of DOM modifications
which can lead to serious performance problems in the application.

Moreover, IDREFs cannot cross over Shadow DOM boundaries,
so any case which requires an ARIA relationship across these boundaries cannot be implemented today

This API would allow authors to associate related elements using a JavaScript object reference.

#### Example code

```html
<x-combobox>
  <x-optionlist>
    <x-option>Option 1</x-option>
    <x-option>Option 2</x-option>
    <x-option>Option 3</x-option>
 </x-optionlist>
</x-combobox>
```

```js
var combobox = document.querySelector('x-combobox');
var shadowRoot = combobox.createShadowRoot();
var input = document.createElement('input');
shadowRoot.appendChild(input);

var option1 = combobox.querySelectorAll('x-option')[0];
var axInput = input.accessibleNode;
var axOption1 = option1.accessibleNode;
axInput.activeDescendant = axOption1;
```

### Create virtual accessibility trees

Some authors create web interfaces using an HTML Canvas or some other direct-drawing API to render an interface
instead of using native HTML elements.

Currently the only way to make this type of solution accessible
is by creating hidden DOM elements for accessibility,
either as part of the Canvas fallback content,
or just with DOM elements placed behind the visual UI in the Z-order.
This is an ugly hack and it's wasteful,
as there's a lot of overhead to adding DOM elements to the page -
it impacts layout, style resolution, etc.

Instead, this API makes it possible to create virtual accessibility objects
for a portion of a page's accessibility tree.

#### Example code

```js
var canvas = document.querySelector('canvas');

// ... draw UI into canvas ...

var axRoot = canvas.accessibleNode;

var axOkButton = new AccesibleNode("button");
axOkButton.label = "Ok";
axOkButton.offsetWidth = /* width of canvas-drawn button, and similarly below */ 40;
axOkButton.offsetHeight = 10;
axOkButton.offsetLeft = 50;
axOkButton.offsetTop = 40;
// canvas already listens for click event within these coordinates, so fallback click event will do the job for us

axRoot.children.append(axOkButton);

var axCancelButton = new AccesibleNode("button");
axCancelButton.label = "Cancel";
axCancelButton.offsetWidth = /* width of canvas-drawn button, and similarly below */ 40;
axCancelButton.offsetHeight = 10;
axCancelButton.offsetLeft = 100;
axCancelButton.offsetTop = 40;

axRoot.children.append(axCancelButton);



```

## Introducing the Accessibility Object Model

This spec proposes the *Accessibility Object Model*, a new API that makes it
possible to (1) explore the accessibility tree automatically generated by
the browser from the DOM, (2) modify the accessibility tree to change what's
exposed to assistive technology, and (3) directly respond to messages from
assistive technology.

In the following sections we'll explore each of these major categories of
functionality and how we propose the accessibility API would work.

### Exploring the accessibility tree

The most basic thing that's possible using the proposed Accessibility
Object Model is exploring and querying the existing accessibility tree.
Most user agents create the accessibility tree lazily or on-demand, only
when an assistive technology client is running. However, conceptually
the accessibility tree is always there, and the fact that it's only
generated lazily is an implementation detail.

The accessibility tree is created from the DOM, based on both the
elements and their style. As the DOM is mutated, the accessibility tree
changes with it, sending notifications to assistive technology clients.
However, without the AOM there's no way for a web author to directly
observe the accessibility tree.

With the AOM, every DOM node has a property **accessibleNode** that
accesses that element's corresponding object in the accessibility tree,
if it has one. Most DOM nodes will have an accessible node, with a few
exceptions - an element might not have an accessible node if it's
not currently attached to a visible Document, or if it's not currently
displayed, for example.

Accessing an element's accessible node allows you to determine its
role. This example shows how you could figure out the role assigned to
an HTML INPUT element with a type of "range":

```html
<input id="myinput" type="range" value="5" min="1" max="10">
<script>
  var input = document.querySelector("#myinput");
  var axInput = input.accessibleNode;
  axInput.role;  // returns "slider"
</script>

```
