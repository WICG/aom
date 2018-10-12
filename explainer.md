# Accessibility Object Model

**Authors:**

* Alice Boxhall, Google, aboxhall@google.com
* James Craig, Apple, jcraig@apple.com
* Dominic Mazzoni, Google, dmazzoni@google.com
* Alexander Surkov, Mozilla, surkov.alexander@gmail.com

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

  - [Introduction](#introduction)
  - [Motivating use cases](#motivating-use-cases)
  - [The Accessibility Object Model](#the-accessibility-object-model)
    - [Reflecting ARIA attributes](#reflecting-aria-attributes)
    - [Reflecting Element references](#reflecting-element-references)
      - [Use case 2: Setting relationship properties without needing to use IDREFs](#use-case-2-setting-relationship-properties-without-needing-to-use-idrefs)
    - [Custom Elements APIs](#custom-elements-apis)
      - [Use case 1: Setting non-reflected (“default”) accessibility properties for Web Components](#use-case-1-setting-non-reflected-default-accessibility-properties-for-web-components)
        - [Default semantics via customElements.define()](#default-semantics-via-customelementsdefine)
        - [Per-instance, dynamic semantics via the `createdCallback()` reaction](#per-instance-dynamic-semantics-via-the-createdcallback-reaction)
    - [User action events from Assistive Technology](#user-action-events-from-assistive-technology)
      - [Use case 3: Listening for events from Assistive Technology](#use-case-3-listening-for-events-from-assistive-technology)
    - [Virtual Accessibility Nodes](#virtual-accessibility-nodes)
      - [Use case 4: Adding non-DOM nodes (“virtual nodes”) to the Accessibility tree](#use-case-4-adding-non-dom-nodes-virtual-nodes-to-the-accessibility-tree)
    - [Full Introspection of an Accessibility Tree - `ComputedAccessibleNode`](#full-introspection-of-an-accessibility-tree---computedaccessiblenode)
      - [Use case 5:  Introspecting the computed tree](#use-case-5--introspecting-the-computed-tree)
      - [Why is accessing the computed properties being addressed last?](#why-is-accessing-the-computed-properties-being-addressed-last)
    - [Audience for the proposed API](#audience-for-the-proposed-api)
    - [What happened to `AccessibleNode`?](#what-happened-to-accessiblenode)
  - [Next Steps](#next-steps)
    - [Incubation](#incubation)
  - [Additional thanks](#additional-thanks)
- [Appendices](#appendices)
  - [Background: assistive technology and the accessibility tree](#background-assistive-technology-and-the-accessibility-tree)
    - [Accessibility node properties](#accessibility-node-properties)
  - [Background: DOM tree, accessibility tree and platform accessibility APIs](#background-dom-tree-accessibility-tree-and-platform-accessibility-apis)
    - [Mapping native HTML to the accessibility tree](#mapping-native-html-to-the-accessibility-tree)
    - [ARIA](#aria)
  - [Appendix: `AccessibleNode` naming](#appendix-accessiblenode-naming)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Introduction

This effort aims to create a JavaScript API
to allow developers to modify (and eventually explore) the accessibility tree
for an HTML page.

## Motivating use cases

(More background on existing APIs can be found in the [Appendices](#appendices).)

Web apps that push the boundaries of what's possible on the web struggle to make them accessible
because the APIs aren't yet sufficient -
in particular, they are much less expressive than the native APIs that the browser communicates with.

1. Setting non-reflected (“default”) accessibility properties for [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components) which can be overridden by page authors
    - Currently, Web Components are forced to use ARIA to declare their default semantics.
    This causes ARIA attributes which are really implementation details 
    to "leak" into the DOM. 
    - This capability _need not_, but _may_ be limited to Web Components.
2.  Setting [relationship properties](https://www.w3.org/TR/wai-aria-1.1/#attrs_relationships) without needing to use IDREFs
    - Currently, to specify any ARIA relationship,
     an author must specify a unique ID on any element which may be the target
     of the relationship.
    - In the case of something like 
    [`aria-activedescendant`](https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant),
    this may be one of hundreds or thousands of elements, 
    depending on the UI.
    This requirement makes these APIs cumbersome to use
    and lead to many extra DOM attributes being necessary.
3. Listening for events from Assistive Technology
   - Currently, _only_ built-in elements have the capability to react to events,
     typically triggered by user actions such as 
     ["simulated click"](https://developer.android.com/reference/android/view/accessibility/AccessibilityEvent.html#TYPE_VIEW_CLICKED) 
     or ["increment"](https://developer.apple.com/documentation/objectivec/nsobject/1615076-accessibilityincrement).
4. Adding non-DOM nodes (“virtual nodes”) to the Accessibility tree 
   - For example, to express a complex UI built out of a `<canvas>` element,
     or streaming a remote desktop to a `<video>` element, etc.
   - These should be able to express at least the same set of accessible properties as Elements, 
     as well as parent/child/other relationships with other virtual nodes, 
     and position/dimensions.
5. Introspecting the computed accessibility tree
   - Developers currently have no way to probe or test how ARIA and other accessible properties are applied.

## The Accessibility Object Model

The Accessibility Object Model (AOM) is a set of changes to HTML and related standards
to address the use cases above.

(Note: If you were familiar with an earlier version of AOM,
you might be wondering [what happened to `AccessibleNode`?](#what-happened-to-accessiblenode))

### Reflecting ARIA attributes

We will 
[reflect](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflect) 
ARIA attributes on HTML elements.

This is now a part of the [ARIA 1.2 spec](https://www.w3.org/TR/wai-aria-1.2/#idl-interface).

```js
el.role = "button";
el.ariaPressed = "true";  // aria-pressed is a tristate attribute
el.ariaDisabled = true;   // aria-disabled is a true/false attribute
```

### Reflecting Element references

Straight reflection of ARIA properties 
would reflect relationship attributes like `aria-labelledby` as strings:

```js
el.ariaDescribedBy = "id1";
```

results in
```html
<div aria-describedby="id1">
```

We propose augmenting this API with non-reflected properties 
which take element references:

```js
el.ariaDescribedByElements = [labelElement1, labelElement2];
el.ariaActiveDescendantElement = ownedElement1;
```

This would allow specifying semantic relationships between elements
without the need to assign globally unique ID attributes to each element
which participates in a relationship.

Moreover, this would enable authors using open `ShadowRoot`s
to specify relationships which cross over Shadow DOM boundaries.

This API is being [proposed](https://github.com/whatwg/html/issues/3515)
as a change to the WHATWG HTML spec.

#### Use case 2: Setting relationship properties without needing to use IDREFs

Today, an author attempting to express a relationship across Shadow DOM boundaries
might attempt using `aria-activedescendant` like this:
```html
<custom-combobox>
  #shadow-root (open)
  |  <!-- this doesn't work! -->
  |  <input aria-activedescendant="opt1"></input>
  |  <slot></slot>
  <custom-optionlist>
    <x-option id="opt1">Option 1</x-option>
    <x-option id="opt2">Option 2</x-option>
    <x-option id='opt3'>Option 3</x-option>
 </custom-optionlist>
</custom-combobox>
```

This fails, because IDREFs are scoped within the shadowRoot
or document context in which they appear.

An author could specify this relationship programmatically instead:

```js
const input = comboBox.shadowRoot.querySelector("input");
const optionList = comboBox.querySelector("custom-optionlist");
input.activeDescendantElement = optionList.firstChild;
```

This would allow the relationship to be expressed naturally.

### Custom Elements APIs

We propose that Custom Element authors be able to provide static, default semantics
via the `customElements.define()` options,
and dynamic, per-element semantics via a configuration callback.

#### Use case 1: Setting non-reflected (“default”) accessibility properties for Web Components

Today, a library author creating a Web Component is forced to "sprout" ARIA attributes
to express semantics which are implicit for native elements.

```html
<!-- Page author uses the custom elements as they would native elements -->
<custom-tablist>
  <custom-tab selected>Tab 1</custom-tab>
  <custom-tab>Tab 2</custom-tab>
  <custom-tab>Tab 3</custom-tab>
</custom-tablist>

<!-- Custom elements are forced to "sprout" extra attributes to express semantics -->
<custom-tablist role="tablist">
  <custom-tab selected role="tab" aria-selected="true" aria-controls="tabpanel-1">Tab 1</custom-tab>
  <custom-tab role="tab" aria-controls="tabpanel-2">Tab 2</custom-tab>
  <custom-tab role="tab" aria-controle="tabpanel-3">Tab 3</custom-tab>
</custom-tablist>
```

##### Default semantics via customElements.define()

Authors may provide immutable default semantics for a custom element
by setting properties via the `ElementDefinitionOptions` object
passed in to the `CustomElementRegistry.define()` method.

The properties set on the `ElementDefinitionOptions` object
become the default values to be used
when mapping the custom element to an accessible object.

Note: this is analogous to creating an "immutable class variable" -
these semantic properties are associated with the custom element definition,
not with each custom element instance.
The semantics they define apply to *all* instances of the custom element.

For example, an author creating a custom tab control may define three custom elements
for the individual tabs, the tab list and the tab panel:

```js
class TabListElement extends HTMLElement { ... }
customElements.define("custom-tablist", TabListElement,
                      { role: "tablist", ariaOrientation: "horizontal" });

class TabElement extends HTMLElement { ... }
customElements.define("custom-tab", TabElement,
                      { role: "tab" });

class TabPanelElement extends HTMLElement { ... }
customElements.define("custom-tabpanel", TabPanelElement,
                      { role: "tabpanel" });
```

When a `<custom-tab>` element is mapped into the accessibility tree,
by default it will have a mapped role of tab.

This is analogous to how a `<button>` element is, by default,
mapped to an accessible object with a role of button.

##### Per-instance, dynamic semantics via the `createdCallback()` reaction

This is being [discussed as part of the W3C Web Components project](https://github.com/w3c/webcomponents/issues/758).

A custom element author may use the `ElementInternals`  object,
provided in the `createdCallback` reaction,
to modify the semantic state of an instance of a custom element
in response to user interaction.

The properties set on the `ElementInternals` object
are used when mapping the element to an accessible object.

Note: this is analogous to setting an "instance variable" -
a copy of these semantic properties is created for each instance of the custom element.
The semantics defined in each apply only to their associated custom element instance object.

```js
class CustomTab extends HTMLElement {
  constructor() {
    super();

    let _privates = {};
  }

  // Observe the custom "active" attribute.
  static get observedAttributes() { return ["active"]; }

  createdCallback(elementInternals) {
    // Keep a private reference to the internals object.
    _privates.internals = elementInternals;
  }

  connectedCallback() {
    _privates.tablist = this.parentElement;
  }

  setTabPanel(tabpanel) {
    if (tabpanel.localName !== "custom-tabpanel" || tabPanel.id === "")
      return;  // fail silently

    _privates.tabpanel = tabpanel;
    tabpanel.setTab(this);
    _privates.internals.ariaControls = tabPanel;    // does not reflect
  }

  // ... setters/getters for custom properties which reflect to attributes

  // When the custom "active" attribute changes,
  // keep the accessible checked state in sync.
  attributeChangedCallback(name, oldValue, newValue) {
    switch(name) {
    case "active":
      let active = (newValue != null);
      _privates.tabpanel.shown = active;
      _privates.internals.ariaSelected = (newValue !== null);
      if (selected)
        this._tablist.setSelectedTab(this);  // ensure no other tab has "active" set
        break;
    }
  }
}

customElements.define("custom-tab", CustomTab, { role: "tab" });
```

Authors using these elements may override the default semantics using ARIA attributes as normal.

For example, an author may modify the appearance of a <custom-tablist> element to appear as a vertical list.
They could add an aria-orientation attribute to indicate this,
overriding the default semantics set in the custom element definition.

```html
<custom-tablist aria-orientation="vertical" class="vertical-tablist">
  <custom-tab selected>Tab 1</custom-tab>
  <custom-tab>Tab 2</custom-tab>
  <custom-tab>Tab 3</custom-tab>
</div>
```

If the author-provided semantics conflict with the Custom Element semantics,
the author-provided semantics take precedence.

### User action events from Assistive Technology

To preserve the privacy of assistive technology users,
events from assistive technology will typically cause a synthesised DOM event to be triggered:

| **AT event**     | **Targets**                                                                        | **DOM event**                                                                   |
|------------------|------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| `click`          | *all elements*                                                                     | `click`                                                                         |
| `focus`          | *all elements*                                                                     | `focus`                                                                         |
| `select`         | Elements whose mapped role is `cell` or `option`                                   | `click`                                                                         |
| `scrollIntoView` | (n/a)                                                                              | No event                                                                        |
| `dismiss`        | *all elements*                                                                     | Keypress sequence for `Escape` key                                              |
| `contextMenu`    | *all elements*                                                                     | `contextmenu`                                                                   |
| `scrollByPage`   | *all elements*                                                                     | Keypress sequence for `PageUp` or `PageDown` key, depending on scroll direction |
| `increment`      | Elements whose mapped role is `progressbar`, `scrollbar`, `slider` or `spinbutton` | Keypress sequence for `Up` key                                                  |
| `decrement`      | Elements whose mapped role is `progressbar`, `scrollbar`, `slider` or `spinbutton` | Keypress sequence for `Down` key                                                |
| `setValue`       | Elements whose mapped role is `combobox`,`scrollbar`,`slider` or `textbox`         | TBD                                                                             |

We will also add some new [`InputEvent`](https://www.w3.org/TR/uievents/#inputevent) types:

* `increment`
* `decrement`
* `dismiss`
* `scrollPageUp`
* `scrollPageDown`

These will be triggered via assistive technology events,
along with the synthesised keyboard events listed in the above table,
and also synthesised when the keyboard events listed above
occur in the context of a valid target for the corresponding assistive technology event.

For example,
if a user not using assistive technology presses the `Escape` key in any context,
an `input` event with a type of `dismiss` will be fired at the focused element
along with the keypress sequence.

If the same user pressed `Up` while page focus was on
a `<input type="range">` *or* an element with a role of `slider`
(either of which will have a computed role of `slider`),
an `input` event with a type of `increment` will be fired at the focused element
along with the keypress sequence.

#### Use case 3: Listening for events from Assistive Technology

For example:

* A user may be using voice control software and they may speak the name of a
  button somewhere in a web page.
  The voice control software finds the button matching that name in the
  accessibility tree and sends an *action* to the browser to click on that button.
* That same user may then issue a voice command to scroll down by one page.
  The voice control software finds the root element for the web page and sends
  it the scroll *action*.
* A mobile screen reader user may navigate to a slider, then perform a gesture to
  increment a range-based control.
  The screen reader sends the browser an increment *action* on the slider element
  in the accessibility tree.

Currently, browsers implement partial support for accessible actions 
either by implementing built-in support for native HTML elements 
(for example, a native HTML `<input type="range">` 
already supports increment and decrement actions,
and text boxes already support actions to set the value or insert text).

However, there is no way for web authors to listen to accessible actions on
custom elements.  
For example, the 
[custom slider above with a role of `slider`](#use-case-1-setting-non-reflected-default-accessibility-properties-for-web-components)
prompts a suggestion on VoiceOver for iOS 
to perform swipe gestures to increment or decrement, 
but there is no way to handle that semantic event via any web API.

Developers will be able to listen for keyboard events
or input events to capture that semantic event.

For example, to implement a custom slider,
the author could handle the `Up` and `Down` key events
as recommended in the [ARIA Authoring Practices guide](https://www.w3.org/TR/wai-aria-practices-1.1/#slider_kbd_interaction),
and this would handle the assistive technology event as well.

```js
customSlider.addEventListener('keydown', (event) => {
  switch (event.code) {
  case "ArrowUp":
    customSlider.value += 1;
    return;
  case "ArrowDown":
    customSlider.value -= 1;
    return;
});
```

### Virtual Accessibility Nodes

**Virtual Accessibility Nodes** will allow authors
to expose "virtual" accessibility nodes,
which are not associated directly with any particular DOM element,
to assistive technology.

This mechanism is often present in native accessibility APIs,
in order to allow authors more granular control over the accessibility
of custom-drawn APIs.

```IDL
// An AccessibleNode represents a virtual accessible node.
interface AccessibleNode {
    attribute DOMString? role;
    attribute DOMString? name;
    
    attribute DOMString? autocomplete;
    // ... all other ARIA-equivalent attributes

    // Non-ARIA equivalent attributes necessary for virtual nodes only
    attribute DOMString? offsetLeft;
    attribute DOMString? offsetTop;
    attribute DOMString? offsetWidth;
    attribute DOMString? offsetHeight;
    attribute AccessibleNode? offsetParent;

    // Only affects accessible focus
    boolean focusable;

    // Tree walking
    readonly attribute AccessibleNode? parent;
    readonly attribute ComputedAccessibleNode? firstChild;
    readonly attribute ComputedAccessibleNode? lastChild;
    readonly attribute ComputedAccessibleNode? previousSibling;
    readonly attribute ComputedAccessibleNode? nextSibling;

    // Actions
    void focus();

    // Tree modification
    AccessibleNode insertBefore(AccessibleNode node, Node? child);
    AccessibleNode appendChild(AccessibleNode node);
    AccessibleNode replaceChild(AccessibleNode node, AccessibleNode child);
    AccessibleNode removeChild(AccessibleNode child);
};

```

```idl
partial interface Element {
  AccessibleNode attachAccessibleRoot();
}
```

- Calling `attachAccessibleRoot()` causes an `AccessibleNode` to be associated with a `Node`.
  - The returned `AccessibleNode` forms the root of a virtual accessibility tree.
  - The Node's DOM children are implicitly ignored for accessibility once an `AccessibleRoot` is attached - there is no mixing of DOM children and virtual accessible nodes.
- Like `ShadowRoot`, an element may only have one associated `AccessibleRoot`.
- Only `AccessibleNode`s may have `AccessibleNodes` as children, 
  and `AccessibleNode`s may only have `AccessibleNode`s as children.

#### Use case 4: Adding non-DOM nodes (“virtual nodes”) to the Accessibility tree 

For example, to express a complex UI built out of a `<canvas>` element:

```js
// Implementing a canvas-based spreadsheet's semantics
canvas.attachAccessibleRoot();
let table = canvas.accessibleRoot.appendChild(new AccessibleNode());
table.role = 'table';
table.colCount = 10;
table.rowcount = 100;
let headerRow = table.appendChild(new AccessibleNode());
headerRow.role = 'row';
headerRow.rowindex = 0;
// etc. etc.
```

Virtual nodes will typically need to have location and dimensions set explicitly:

```js
cell.offsetLeft = "30px";
cell.offsetTop = "20px";
cell.offsetWidth = "400px";
cell.offsetHeight = "300px";
cell.offsetParent = table;
```

If offsetParent is left unset, 
the coordinates are interpreted relative to the accessible node's parent.

To make a node focusable, the `focusable` attribute can be set. 
This is similar to setting tabIndex=-1 on a DOM element.

```js
virtualNode.focusable = true;
```

Virtual accessible nodes are not focusable by default.

Finally, to focus an accessible node, call its focus() method.

```js
virtualNode.focus();
```

When a virtual accessible node is focused, 
input focus in the DOM is unchanged. 
The focused accessible node is reported to assistive technology
and other accessibility API clients, 
but no DOM events are fired and document.activeElement is unchanged.

When the focused DOM element changes, accessible focus follows it:
the DOM element's associated accessible node gets focused.

### Full Introspection of an Accessibility Tree - `ComputedAccessibleNode`

```idl
partial interface Window {
  [NewObject] ComputedAccessibleNode getComputedAccessibleNode(Element el);
}
```

```idl
interface ComputedAccessibleNode {
    // Same set of attributes as AccessibleNode, but read-only
    readonly attribute DOMString? role;
    readonly attribute DOMString? name;
    
    readonly attribute DOMString? autocomplete;
    // ... all other ARIA-equivalent attributes

    // Non-ARIA equivalent attributes
    readonly attribute DOMString? offsetLeft;
    readonly attribute DOMString? offsetTop;
    readonly attribute DOMString? offsetWidth;
    readonly attribute DOMString? offsetHeight;
    readonly attribute AccessibleNode? offsetParent;
    readonly boolean focusable;

    readonly attribute AccessibleNode? parent;
    readonly attribute ComputedAccessibleNode? firstChild;
    readonly attribute ComputedAccessibleNode? lastChild;
    readonly attribute ComputedAccessibleNode? previousSibling;
    readonly attribute ComputedAccessibleNode? nextSibling;
};

```

#### Use case 5:  Introspecting the computed tree

The **Computed Accessibility Tree** API will allow authors to access
the full computed accessibility tree -
all computed properties for the accessibility node associated with each DOM element,
plus the ability to walk the computed tree structure including virtual nodes.

This will make it possible to:
  * write any programmatic test which asserts anything
    about the semantic properties of an element or a page.
  * build a reliable browser-based assistive technology -
    for example, a browser extension which uses the accessibility tree
    to implement a screen reader, screen magnifier, or other assistive functionality;
    or an in-page tool.
  * detect whether an accessibility property
    has been successfully applied
    (via ARIA or otherwise)
    to an element -
    for example, to detect whether a browser has implemented a particular version of ARIA.
  * do any kind of console-based debugging/checking of accessibility tree issues.
  * react to accessibility tree state,
    for example, detecting the exposed role of an element
    and modifying the accessible help text to suit.

#### Why is accessing the computed properties being addressed last?

**Consistency**
Currently, the accessibility tree is not standardized between browsers:
Each implements accessibility tree computation slightly differently.
In order for this API to be useful,
it needs to work consistently across browsers,
so that developers don't need to write special case code for each.

We want to take the appropriate time to ensure we can agree
on the details for how the tree should be computed
and represented.

**Performance**
Computing the value of many accessible properties requires layout.
Allowing web authors to query the computed value of an accessible property
synchronously via a simple property access
would introduce confusing performance bottlenecks.

We will likely want to create an asynchronous mechanism for this reason,
meaning that it will not be part of the `accessibleNode` interface.

**User experience**
Compared to the previous three phases,
accessing the computed accessibility tree will have the least direct impact on users.
In the spirit of the [Priority of Constituencies](https://www.w3.org/TR/html-design-principles/#priority-of-constituencies),
it makes sense to tackle this work last.

### Audience for the proposed API

This API is will be primarily of interest to
the relatively small number of developers who create and maintain
the JavaScript frameworks and widget libraries that power the vast majority of web apps.
Accessibility is a key goal of most of these frameworks and libraries,
as they need to be usable in as broad a variety of contexts as possible.
A low-level API would allow them to work around bugs and limitations
and provide a clean high-level interface that "just works" 
for the developers who use their components.

This API is also aimed at developers of large flagship web apps that
push the boundaries of the web platform. 
These apps tend to have large development teams 
who look for unique opportunities to improve performance 
using low-level APIs like Canvas. 
These development teams have the resources to make accessibility a priority too, 
but existing APIs make it very cumbersome.

### What happened to `AccessibleNode`?

Initially, our intention was to combine these use cases into a read/write API
analogous to the DOM,
wherein each DOM `Element` would have an associated `AccessibleNode`
allowing authors to read and write accessible properties.
This was named the Accessibility Object Model,
analogous to the Document Object Model.

However, as discussions progressed it became clear that there were some issues with this model:
- Computing the accessibility tree should not be necessary in order to modify it -
getting an `AccessibleNode` to write to 
should thus not depend on getting the computed properties.
- Exposing the computed accessibility tree requires standardisation across browsers
of how the tree is computed.
- If we are not exposing computed properties on an `Element`'s `AccessibleNode`,
it's unclear what the purpose of this object is beyond a "bag of properties".
- Determining the order of precedence of ARIA properties
and `AccessibleNode` properties did not have an obvious "correct" answer.
- Similarly, using exclusively `AccessibleNode`s to express relationships was confusing.

These issues prompted a reassessment, 
and a simplification of the API based around the original set of use cases
we were committed to addressing.

## Next Steps

The Accessibility Object Model development is led by a team of editors
that represent several major browser vendors.

Issues can be filed on GitHub:

https://github.com/WICG/aom/issues

### Incubation

We intend to continue development of this spec as part of the
[Web Platform Incubator Community Group (WICG)](https://www.w3.org/community/wicg/).
Over time it may move into its own community group.

Our intent is for this group's work to be almost entirely orthogonal to the
current work of the [Web Accessibility Initiative](https://www.w3.org/WAI/)
groups such as [ARIA](https://www.w3.org/TR/wai-aria/). While ARIA defines
structural markup and semantics for accessibility properties on the web,
often requiring coordination with assistive technology vendors and native platform
APIs, the AOM simply provides a parallel JavaScript API that provides
more low-level control for developers and fills in gaps in the web platform,
but without introducing any new semantics.

## Additional thanks

Many thanks for valuable feedback, advice, and tools from:

* Alex Russell
* Bogdan Brinza
* Chris Fleizach
* Cynthia Shelley
* David Bolter
* Domenic Denicola
* Elliott Sprehn
* Ian Hickson
* Joanmarie Diggs
* Marcos Caceres
* Nan Wang
* Robin Berjon
* Tess O'Connor

Bogdan Brinza and Cynthia Shelley of Microsoft were credited as authors of an
earlier draft of this spec but are no longer actively participating.

# Appendices

## Background: assistive technology and the accessibility tree

Assistive technology, in this context, refers to a third party application
which augments or replaces the existing UI for an application.
One well-known example is a screen reader,
which replaces the visual UI and pointer-based UI
with an auditory output (speech and tones)
and a keyboard and/or gesture-based input mechanism.

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

![Flow from application UI to accessibility tree to assistive technology to user](images/a11y-tree.png)

Both the alternative interface's *output*
(e.g. speech and tones,
updating a [braille display](https://en.wikipedia.org/wiki/Refreshable_braille_display),
moving a [screen magnifier's](https://en.wikipedia.org/wiki/Screen_magnifier) focus)
and *input*
(e.g. keyboard shortcuts, gestures, braille routing keys,
[switch devices](https://en.wikipedia.org/wiki/Switch_access), voice input)
are completely the responsibility of the assistive technology,
and are abstracted away from the application.

For example, a [VoiceOver](https://www.apple.com/voiceover/info/guide/) user
interacting with a native application on OS X
might press the key combination
"Control Option Spacebar" to indicate that they wish to click the UI element which the screen reader is currently visiting.

![A full round trip from UI element to accessibility node to assistive technology to user to user keypress to accessibility API action method back to UI element](images/a11y-tree-example.png)

These keypresses would never be passed to the application,
but would be interpreted by the screen reader,
which would then call the
[`accessibilityPerformPress()`](https://developer.apple.com/reference/appkit/nsaccessibilitybutton/1525542-accessibilityperformpress?language=objc)
function on the accessibility node representing the UI element in question.
The application can then handle the press action;
typically, this routes to the code which would handle a click event.

Accessibility APIs are also popular for testing and automation.
They provide a way to examine an application's state and manipulate its UI from out-of-process,
in a robust and comprehensive way.
While assistive technology for users with disabilities
is typically the primary motivator for accessibility APIs,
it's important to understand that these APIs are quite general
and have many other uses.

### Accessibility node properties

Each node in the accessibility tree may be referred to as an **accessibility node**.
An accessibility node always has a **role**, indicating its semantic purpose.
This may be a grouping role,
indicating that this node merely exists to contain and group other nodes,
or it may be an interactive role,
such as `"button"`.

![Accessibility nodes in an accessibility tree, showing roles, names, states and properties](images/a11y-node.png)

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
such as the current **value**
(e.g. `"10"` for a range, or `"Jane"` for a text input),
or **state** information
(e.g. `"checked"` for a checkbox, or `"focused"`).

Interactive accessibility nodes may also have certain **actions** which may be performed on them.
For example, a button may expose a `"press"` action, and a slider may expose
`"increment"` and `"decrement"` actions.

These properties and actions are referred to as the *semantics* of a node.
Each accessibility API expresses these concepts slightly differently,
but they are all conceptually similar.

##  Background: DOM tree, accessibility tree and platform accessibility APIs

The web has rich support for making applications accessible,
but only via a *declarative* API.

The DOM tree is translated, in parallel,
into the primary, visual representation of the page,
and the accessibility tree,
which is in turn accessed via one or more *platform-specific* accessibility APIs.

![HTML translated into DOM tree translated into visual UI and accessibility tree](images/DOM-a11y-tree.png)

Some browsers support multiple accessibility APIs across different platforms,
while others are specific to one accessibility API.
However, any browser that supports at least one native accessibility API
has some mechanism for exposing a tree structure of semantic information.
We refer to that mechanism, regardless of implementation details,
as the **accessibility tree** for the purposes of this API.

### Mapping native HTML to the accessibility tree

Native HTML elements are implicitly mapped to accessibility APIs.
For example, an  `<img>` element will automatically be mapped
to an accessibility node with a role of `"image"`
and a label based on the `alt` attribute (if present).

![<img> node translated into an image on the page and an accessibility node](images/a11y-node-img.png)


### ARIA

Alternatively, [ARIA](https://www.w3.org/TR/wai-aria-1.1/)
allows developers to annotate elements with attributes to override
the default role and semantic properties of an element -
but not to expose any accessible actions.

![<div role=checkbox aria-checked=true> translated into a visual presentation and a DOM node](images/a11y-node-ARIA.png)

In either case there's a one-to-one correspondence
between a DOM node and a node in the accessibility tree,
and there is minimal fine-grained control over the semantics of the corresponding accessibility node.

## Appendix: `AccessibleNode` naming

We have chosen the name `AccessibleNode` for the class representing one
node in the virtual accessibility tree.

In choosing this name, we have tried to pick a balance between brevity,
clarity, and generality.

* Brevity: The name should be as short as possible.
* Clarity: The name should reflect the function of the API,
  without using opaque abbreviations or contractions.
* Generality: The name should not be too narrow and limit the scope of the spec.

Below we've collected all of the serious names that have been proposed
and a concise summary of the pros and cons of each.

Suggestions for alternate names or votes for one of the other names below
are still welcome, but please try to carefully consider the existing suggestions and
their cons first. Rough consensus has already been achieved and we'd rather work
on shipping something we can all live with rather than trying to get the perfect
name.

Proposed name          | Pros                                                      | Cons
-----------------------|-----------------------------------------------------------|-------
`Aria`                 | Short; already associated with accessibility              | Confusing because ARIA is the name of a spec, not the name of one node in an accessibility tree.
`AriaNode`             | Short; already associated with accessibility              | Implies the AOM will only expose ARIA attributes, which is too limiting
`A11ement`             | Short; close to `Element`                                 | Hard to pronounce; contains numbers; not necessarily associated with an element; hard to understand meaning
`A11y`                 | Very short; doesn't make assertions about DOM association | Hard to pronounce; contains numbers; hard to understand meaning
`Accessible`           | One full word; not too hard to type                       | Not a noun
`AccessibleNode`       | Very explicit; not too hard to read                       | Long; possibly confusing (are other `Node`s not accessible?)
`AccessibleElement`    | Very explicit                                             | Even longer; confusing (are other `Element`s not accessible?)
`AccessibilityNode`    | Very explicit                                             | Extremely long; nobody on the planet can type 'accessibility' correctly first try
`AccessibilityElement` | Very explicit                                             | Ludicrously long; still requires typing 'accessibility'
