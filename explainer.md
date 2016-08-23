<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Background: assistive technology and the accessibility tree](#background-assistive-technology-and-the-accessibility-tree)
  - [Accessibility node properties](#accessibility-node-properties)
- [Existing accessibility APIs](#existing-accessibility-apis)
  - [Native platform accessibility APIs](#native-platform-accessibility-apis)
  - [Gaps in the web platform's accessibility story](#gaps-in-the-web-platforms-accessibility-story)
  - [Audience for the proposed API](#audience-for-the-proposed-api)
- [The Accessibility Object Model](#the-accessibility-object-model)
  - [Exploring the accessibility tree](#exploring-the-accessibility-tree)
- [Use cases](#use-cases)
  - [Use DOM node references instead of IDREFs](#use-dom-node-references-instead-of-idrefs)
  - [Create virtual accessibility trees](#create-virtual-accessibility-trees)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

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
This is referred to as the **accessibility tree**.

An assistive technology user interacts with the application almost exclusively via this API,
as the assistive technology uses it both to create the alternative interface,
and to route user interaction events triggered by the user's commands to the assistive technology.

![Flow from application UI to accessibility tree to assistive technology to user](images/a11y-tree.jpg)

For example, a [VoiceOver](https://www.apple.com/voiceover/info/guide/) user might press the key combination
"Control Option Spacebar" to indicate that they wish to click the element which the screen reader is currently visiting.
These keypresses would never be passed to the application,
but would be interpreted by the screen reader,
which would then call the `accessibilityPerformPress()` function on the element via the API.
This is then routed back to the DOM as a `click` event by the browser.

In addition to screen readers, there's a variety of other types of assistive
technology that uses the same accessibility APIs, including *magnifiers*
for users with low vision, and both *switch access* and *voice control* software
for users with a motor impairment.

Accessibility APIs are also popular for testing and automation.
They provide a way to examine an application's state and manipulate its UI
from out-of-process, in a robust and comprehensive way. While assistive
technology for users with disabilities is typically the primary motivator for
accessibility APIs, it's important to understand that these APIs are quite general
and have many other uses.

### Accessibility node properties

Each node in the accessibility tree may be referred to as an **accessibility node**.
An accessibility node always has a **role**, indicating its semantic purpose.
This may be a grouping role,
indicating that this node merely exists to contain and group other nodes,
or it may be an interactive role,
such as `"button"`.

![Accessibility nodes in an accessibility tree, showing roles, names, states and properties](images/a11y-node.jpg)

The user, via assistive technology, may explore the accessibility tree at various levels.
They may interact with grouping nodes,
such as a landmark element which helps a user navigate sections of the page,
or they may interact with interactive nodes,
such as a button.
In both of these cases,
the node will usually need to have a **label** (often referred to as a **name**)
to indicate the node's purpose in context.
For example, a button may have a label of "Ok" or "Menu".

Accessibility nodes may also have other properties,
such as the current **value** (e.g. `"10"` for a range, or `"Jane"` for a text input),
or **state** information (e.g. `"checked"` for a checkbox, or `"focused"`).

Interactive accessibility nodes may also have certain **actions** which may be performed on them.
For example, a button may expose a `"press"` action.

These properties and actions are referred to as the *semantics* of a node.

## Existing accessibility APIs

The web has rich support for making applications accessible,
but only via a *declarative* API.

Native HTML elements are implicitly mapped to accessibility APIs.
For example, an  `<img>` element will automatically be mapped
to an accessibility node with a role of `"image"`
and a label based on the `alt` attribute (if present).

![<img> node translated into an image on the page and an accessibility node](images/img-node.jpg)

Alternatively, [ARIA](https://www.w3.org/TR/wai-aria-1.1/)
allows developers to annotate elements with attributes to override
the default role and semantic properties of an element -
but not to expose any accessible actions.

![<div role=checkbox aria-checked=true> translated into a visual presentation and a DOM node](images/aria-checkbox.jpg)

In either case there's a one-to-one correspondence between a DOM node and a node in the accessibility tree,
and there is minimal fine-grained control over the semantics of the corresponding accessibility node.

### Native platform accessibility APIs

Platform accessibility APIs typically also make it straightforward to achieve the most common tasks,
such as adding an accessible text label for an image,
but, where necessary, have the power to give the developer total control over optimizing the accessible experience.

For example, an Android application developer may use the standard Android components,
which will expose the correct semantics and bounding boxes for touch exploration,
and have simple hooks for setting the accessible name.

However, if they are creating a fully-customised user interface,
the framework gives them the ability to create a
[virtual view hierarchy](https://developer.android.com/guide/topics/ui/accessibility/apps.html#virtual-hierarchy),
effectively exposing a sub-tree of accessibility nodes for a single, complex view.

### Gaps in the web platform's accessibility story

Since the web is missing this type of low-level API, it leads to significant gaps.
Web apps that push the boundaries of what's possible on the web struggle to make them accessible
because the APIs aren't yet sufficient.
New web platform features aren't fully accessible
or don't interact well with existing accessibility APIs,
forcing developers to choose between using new standard or remaining accessible.

* A library author creating a custom element is forced to "sprout" ARIA attributes
to express semantics which are implicit for native elements.

```html
<!-- Page author uses the custom element as they would a native element -->
<custom-slider min="0" max="5" value="3"></custom-slider>

<!-- Custom element is forced to "sprout" extra attributes to express semantics -->
<custom-slider min="0" max="5" value="3" role="slider"
               tabindex="0" aria-valuemin="0" aria-valuemax="5"
               aria-valuenow="3" aria-valuetext="3"></custom-slider>
```

* Moreover, there is no way to connect custom HTML elements to accessible actions.
For example, the custom slider above with a role of `slider`
prompts a suggestion on VoiceOver for iOS
to perform swipe gestures to increment or decrement,
but there is no way to handle that gesture via the DOM API.

* Many ARIA relationship properties depend on IDREFs,
meaning that elements participating in these relationship must have globally unique IDs.
This is ugly, costly and fiddly to achieve,
particularly in the context of framework or library code.

* A custom element which uses shadow DOM
and which needs to express semantic relationships such as
["active descendant"](https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant)
may be unable to do so, as `aria-activedescendant` relies on IDREF values,
which are scoped to a single document fragment.

```html
<x-combobox>
  #shadow-root
  |  <!-- this doesn't work! -->
  |  <input aria-activedescendant="opt1"></input>
  <x-optionlist>
    <x-option id="opt1">Option 1</x-option>
    <x-option id="opt2">Option 2</x-option>
    <x-option id='opt3'>Option 3</x-option>
 </x-optionlist>
</x-combobox>

```


A low-level API would bridge these gap,
allowing authors to bypass artificial limitations or bugs in the platform
and provide a custom accessible experience where necessary.

### Audience for the proposed API

We don't expect or encourage the average web developer
to want or need a low-level accessibility API for most things.
Declarative HTML should be sufficient for most web page authors.

This API is aimed at the relatively small number of developers who create and maintain
the JavaScript frameworks and widget libraries that power the vast majority of web apps.
Accessibility is a key goal of most of these frameworks and libraries,
as they need to be usable in as broad a variety of contexts as possible.
A low-level API would allow them to work around bugs and limitations
and provide a clean high-level interface that "just works" for the developers who use their components.

## The Accessibility Object Model

This spec proposes the *Accessibility Object Model*,
a new API that makes it possible to:

1. explore the accessibility tree automatically generated by the browser from the DOM,
2. modify the accessibility tree to change what's exposed to assistive technology, and
3. directly respond to messages from assistive technology.

In the following sections we'll explore each of these major categories of functionality
and how we propose the accessibility API would work.

### Exploring the accessibility tree

The most basic thing that's possible using the proposed Accessibility Object Model
is exploring and querying the existing accessibility tree.

With the AOM, every DOM node has a property **`accessibleNode`**
that accesses that element's corresponding object in the accessibility tree,
if it has one.
Most DOM nodes will have an accessible node, with a few exceptions -
an element might not have an accessible node if it's not currently attached to a visible Document,
or if it's not currently displayed, for example.

Accessing an element's accessible node allows you to determine its role.
This example shows how you could figure out the role assigned to an HTML INPUT element with a type of "range":

```html
<label>
  Rating:
  <input id="myinput" type="range" value="5" min="1" max="10">
</label>
<script>
  var input = document.querySelector("#myinput");
  var axInput = input.accessibleNode;
  axInput.role;  // returns "slider"
</script>
```

Most ARIA attributes have a corresponding property on an accessible node.
In this particular case, we can access
the min, max, and current value of the slider
and its text label, among other things.

```js
axInput.rangeValue;  // returns 5.0
axInput.rangeMin;    // returns 1.0
axInput.rangeMax;    // returns 10.0
axInput.label;       // returns "Rating:"
```

The full list of properties of an AccessibleNode will be discussed below.

The AOM can be used as a form of feature detection and validation, in
particular when using ARIA attributes. For example, we can set an
element's role and see what role is returned in the AOM.

```js
var element = document.createElement("article");
element.accessibleNode.role;  // returns "article" because that's a valid ARIA role

element.setAttribute("role", "toolbar");
element.accessibleNode.role;  // returns "toolbar" because that's a valid ARIA role

element.setAttribute("role", "feed");  // new ARIA 1.1 role
element.accessibleNode.role;  // returns "feed" if supported by the user agent

element.setAttribute("role", "butler");
element.accessibleNode.role;  // returns "article" because "butler" is not a valid role
```

**Open question:**
What should be returned when a node's role does not correspond to an ARIA role?
For example, the HTML **`P`** element is semantically important, and on many
platforms there's a native accessibility role for a paragraph, but there's no
corresponding "paragraph" ARIA role. Options include returning an internal
non-standardized role like "x-paragraph" that may differ by user agent,
or extending the list of roles supported by the AOM to include many non-ARIA roles.

In addition to examining the properties of an individual node, you can
explore an accessible node's relationships with other nodes in the tree.
Just like nodes in the DOM, every accessible node has a parent (unless
it's the root of the tree), and it can have any number of children.

```html
<ol id="list1">
  <li>The Original Series</li>
  <li>The Next Generation</li>
  <li>Deep Space Nine</li>
  <li>Voyager</li>
  <li>Enterprise</li>
</ol>
<script>
  var axList = document.getElementById("list1").accessibleElement;
  var axItem1 = axList.children[0];
  var axItem2 = axList.children[1];
  axItem1.parent == axList;  // returns true;
</script>
```

In addition to **`parent`** and **`children`**, accessible nodes
have relationships like **`activeDescendant`**, which expresses a
relationship between a container element (like a listbox) and its
active child, or **`labelFor`**, which expresses a relationship
between a label and the control that it labels.

### Modifying the accessibility tree

So far we've just seen ways the AOM makes it possible to introspect
and explore the accessibility tree via JavaScript. This is definitely
interesting for use cases such as testing and feature detection,
but it doesn't really add any significant capabilities to the web
platform. The next major category of functionality the AOM enables is
modifying the accessibility tree, and that's where it starts to address
major developer pain points and bridge many gaps in the current platform.

Nearly all properties on an accessible node can be written, not just read.
For example, we could take the slider as in the example above and give it
a role of "scrollbar" instead, and change its accessible label.

```html
<label>
  Rating:
  <input id="myinput" type="range" value="5" min="1" max="10">
</label>
<script>
  var input = document.querySelector("#myinput");
  var axInput = input.accessibleNode;
  axInput.role = "scrollbar";
  axInput.label = "User rating";
</script>
```

Setting a property of an accessible node immediately has an
effect on the accessibility tree. For example, if any assistive
technology was currently examining the user agent, it would
quickly receive a notification that an attribute of an object
within the web page had changed, and upon retrieving that object
it'd get the new value of those properties.

Just as with ARIA, changing properties of accessible nodes has no
effect on the look or feel of the webpage in any other way. Only
clients of that platform's accessibility API are affected.

(Next: talk about the model for the internal state, more feature
detection, etc.)

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
