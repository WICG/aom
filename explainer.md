# Accessibility Object Model

**Authors:**

- Alice Boxhall, Google, aboxhall@google.com
- James Craig, Apple, jcraig@apple.com
- Dominic Mazzoni, Google, dmazzoni@google.com
- Alexander Surkov, Mozilla, surkov.alexander@gmail.com

**Table of Contents**

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Introduction](#introduction)
- [Motivating use cases](#motivating-use-cases)
- [The Accessibility Object Model](#the-accessibility-object-model)
  - [Reflecting ARIA attributes](#reflecting-aria-attributes)
    - [Spec/implementation status](#specimplementation-status)
  - [Reflecting Element references](#reflecting-element-references)
    - [Use case 2: Setting relationship properties without needing to use IDREFs](#use-case-2-setting-relationship-properties-without-needing-to-use-idrefs)
    - [Spec/implementation status](#specimplementation-status-1)
  - [Default semantics for Custom Elements via the `ElementInternals` object](#default-semantics-for-custom-elements-via-the-elementinternals-object)
    - [Use case 1: Setting non-reflected (“default”) accessibility properties for Web Components](#use-case-1-setting-non-reflected-default-accessibility-properties-for-web-components)
    - [Spec/implementation status](#specimplementation-status-2)
  - [User action events from Assistive Technology](#user-action-events-from-assistive-technology)
    - [New InputEvent types](#new-inputevent-types)
    - [Use case 3: Listening for events from Assistive Technology](#use-case-3-listening-for-events-from-assistive-technology)
    - [Spec/implementation status](#specimplementation-status-3)
  - [Virtual Accessibility Nodes](#virtual-accessibility-nodes)
    - [Use case 4: Adding non-DOM nodes (“virtual nodes”) to the Accessibility tree](#use-case-4-adding-non-dom-nodes-virtual-nodes-to-the-accessibility-tree)
    - [Spec/implementation status](#specimplementation-status-4)
  - [Full Introspection of an Accessibility Tree - `ComputedAccessibleNode`](#full-introspection-of-an-accessibility-tree---computedaccessiblenode)
    - [Use case 5: Introspecting the computed tree](#use-case-5-introspecting-the-computed-tree)
    - [Spec/implementation status](#specimplementation-status-5)
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
  - [Appendix: Partial proposed IDL for virtual accessibility nodes](#appendix-partial-proposed-idl-for-virtual-accessibility-nodes)
  - [Appendix: partial proposed IDL for `ComputedAccessibleNode`](#appendix-partial-proposed-idl-for-computedaccessiblenode)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Introduction

This effort aims to develop additions to the web platform
to allow developers to provide information to assistive technology APIs,
and to understand what information browsers provide to those APIs.

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
2. Setting [relationship properties](https://www.w3.org/TR/wai-aria-1.1/#attrs_relationships) without needing to use IDREFs
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
     ["increment"](https://developer.apple.com/documentation/objectivec/nsobject/1615076-accessibilityincrement).
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

```js
el.role = "button";
el.ariaPressed = "true"; // aria-pressed is a tristate attribute
el.ariaDisabled = true; // aria-disabled is a true/false attribute
```

#### Spec/implementation status

This is now a part of the [ARIA 1.2 spec](https://www.w3.org/TR/wai-aria-1.2/#idl-interface).

This is shipping in Safari,
and implemented behind a flag (`enable-experimental-web-platform-features`) in Chrome.

### Reflecting Element references

Straight reflection of ARIA properties
would reflect relationship attributes like `aria-labelledby` as strings:

```js
el.ariaDescribedBy = "id1";
```

results in

```html
<div aria-describedby="id1"></div>
```

We propose augmenting this API with non-reflected properties
which take element references:

```js
el.ariaDescribedByElements = [labelElement1, labelElement2];
el.ariaActiveDescendantElement = ownedElement1;
```

> Note: the `Element` or `Element` suffixes are a naming choice
> for the reflected property,
> and do not imply that there will be both string and Element properties
> for the same attribute.

This would allow specifying semantic relationships between elements
without the need to assign globally unique ID attributes to each element
which participates in a relationship.

Moreover, this would enable authors using open `ShadowRoot`s
to specify relationships which cross over Shadow DOM boundaries.

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

Using Element references,
an author could specify this relationship programmatically instead:

```js
const input = comboBox.shadowRoot.querySelector("input");
const optionList = comboBox.querySelector("custom-optionlist");
input.activeDescendantElement = optionList.firstChild;
```

This would allow the relationship to be expressed naturally.

#### Spec/implementation status

- This API is being [proposed](https://github.com/whatwg/html/issues/3515)
  as a change to the WHATWG HTML spec.
- There is an [open PR](https://github.com/whatwg/html/pull/3917) on the HTML spec
  fleshing out the details for this API.
- This is used in the [ARIA editor's draft](https://w3c.github.io/aria/#AriaAttributes).
- This is [currently being implemented in Blink](https://www.chromestatus.com/feature/6244885579431936).

### Default semantics for Custom Elements via the `ElementInternals` object

We propose that Custom Element authors be able to provide default semantics
via the `ElementInternals` object.

A custom element author may use the `ElementInternals` object
to modify the semantic state of an instance of a custom element
in response to user interaction.

The properties set on the `ElementInternals` object
are used when mapping the element to an accessible object.

If the author-provided semantics conflict with the Custom Element semantics,
the author-provided semantics take precedence.

> Note: this is analogous to setting an "instance variable" -
> a copy of these semantic properties is created for each instance of the custom element.
> The semantics defined in each apply only to their associated custom element instance object.

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
  <custom-tab
    selected
    role="tab"
    aria-selected="true"
    aria-controls="tabpanel-1"
    >Tab 1</custom-tab
  >
  <custom-tab role="tab" aria-controls="tabpanel-2">Tab 2</custom-tab>
  <custom-tab role="tab" aria-controls="tabpanel-3">Tab 3</custom-tab>
</custom-tablist>
```

Using `ElementInternals` to set the default semantics,
a Custom Element may avoid needing to sprout attributes,
and also avoid losing its semantics if authors decide to delete ARIA attributes.

```js
class CustomTab extends HTMLElement {
  constructor() {
    super();
    this._internals = customElements.createInternals(this);
    this._internals.role = "tab";
  }

  // Observe the custom "active" attribute.
  static get observedAttributes() {
    return ["active"];
  }

  connectedCallback() {
    this._tablist = this.parentElement;
  }

  setTabPanel(tabpanel) {
    if (tabpanel.localName !== "custom-tabpanel" || tabPanel.id === "") return; // fail silently

    this._tabpanel = tabpanel;
    tabpanel.setTab(this);
    this._internals.ariaControls = tabPanel; // does not reflect
  }

  // ... setters/getters for custom properties which reflect to attributes

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "active":
        let active = newValue != null;
        this._tabpanel.shown = active;

        // When the custom "active" attribute changes,
        // keep the accessible "selected" state in sync.
        this._internals.ariaSelected = newValue !== null;

        if (selected) this._tablist.setSelectedTab(this); // ensure no other tab has "active" set
        break;
    }
  }
}

customElements.define("custom-tab", CustomTab);
```

Authors using these elements may override the default semantics
using ARIA attributes as normal.

For example, an author may modify the appearance
of a `<custom-tablist>` element to appear as a vertical list.
They could add an `aria-orientation` attribute to indicate this,
overriding the default semantics set in the custom element implementation.

```js
class CustomTabList extends HTMLElement {
  constructor() {
    super();
    this._internals = customElements.createInternals(this);
    this._internals.role = "tablist";
    this._internals.ariaOrientation = "horizontal";
  }

  // ...
}

customElements.define("custom-tablist", CustomTabList);
```

```html
<custom-tablist aria-orientation="vertical" class="vertical-tablist">
  <custom-tab selected>Tab 1</custom-tab>
  <custom-tab>Tab 2</custom-tab>
  <custom-tab>Tab 3</custom-tab>
</custom-tablist>
```

#### Spec/implementation status

- There is an [open PR](https://github.com/whatwg/html/pull/4658) on the WHATWG HTML spec.
- This is [currently being implemented in Blink](https://chromestatus.com/feature/5962105603751936).

### User action events from Assistive Technology

To preserve the privacy of assistive technology users, events from assistive technology 
will typically cause a synthesised DOM event to be triggered. The events are determined by
platform conventions and partially documented in the [ARIA Authoring Practices Guide (APG)](https://www.w3.org/TR/wai-aria-practices/#aria_ex).


| **AT event**          | **Targets**                                                       | Orientation/Direction | **DOM event**                      |
| --------------------- | ----------------------------------------------------------------- | --------------------- | ---------------------------------- |
| `click` or `press`    | _all elements_                                                    |                       | `click` MouseEvent                 |
| `focus`               | _all focusable elements_                                          |                       | `focus` Event                      |
| `blur`                | No targets, as `blur` could potentially 'out' AT users.           |                       | None                               |
| `select`              | Elements whose computed role supports `aria-selected`             |                       | `click` MouseEvent                 |
| `dismiss` or `escape` | _all elements_                                                    |                       | `Escape` KeyboardEvent             |
| `contextMenu`         | _all elements_                                                    |                       | `contextmenu` MouseEvent           |
| `increment`           | Elements w/ computed role `progressbar`, `scrollbar`, or `slider` | vertical              | `Up` KeyboardEvent                 |
|                       | ""                                                                | horizontal LTR        | `Right` KeyboardEvent              |
|                       | ""                                                                | horizontal RTL        | `Left` KeyboardEvent               |
|                       | Elements w/ computed role `spinbutton`                            | orientation n/a       | `Up` KeyboardEvent                 |
| `decrement`           | Elements w/ computed role `progressbar`, `scrollbar`, or `slider` | vertical              | `Down` KeyboardEvent               |
|                       | ""                                                                | horizontal LTR        | `Left` KeyboardEvent               |
|                       | ""                                                                | horizontal RTL        | `Right` KeyboardEvent              |
|                       | Elements w/ computed role `spinbutton`                            | orientation n/a       | `Down` KeyboardEvent               |
| `scrollByPage`        | TBD (possibly custom scroll views)                                |                       | TBD (possibly `PageUp`/`PageDown`) |
| `scrollIntoView`      | TBD                                                               |                       | No equivalent DOM event            |
| `setValue`            | n/a                                                               |                       | No equivalent DOM event            |

#### Notes on the previous table:
- DOM KeyboardEvent sequences include keyup/keydown.
- DOM MouseEvent sequences include mousedown/mouseup and touchstart/touchend where relevant.
- `contextmenu` sequence may need to include MouseEvents, including `mousedown`/`mouseup`/`auxclick`/`contextmenu`.
- Control orientation is determined by the computed value of `aria-orientation` which
  defaults to `horizontal` for `progressbar` and `slider`, and defaults to `vertical` for
  `scrollbar`.
- Natural language direction is determined by the computed value of `dir` which usualy computes to
  to `ltr` (`auto` in most contexts resolves to `ltr`), but can be set to `rtl` for languages such
  as Arabic and Hebrew.
- The DOM event target for DOM KeyboardEvent sequences is the currently focused DOM element,
  regardless if the AT's "point of regard" matches the document.activeElement.
- If a web author does not cancel the DOM event with `Event.preventDefault()` and/or
  `Event.stopPropagation()`, the DOM event should propagate out of the web view an potentially
  trigger the platform behavior of the assistive technology event. For example, if an iOS
  user triggers a native dismiss/escape event but the web author does not capture or cancel the
  DOM Escape key sequence, the browser or system should execute the default functionality of the
  native `accessibilityPerformEscape()` handler.


#### MouseEvent Object Properties

| **MouseEvent** | **`button`**        | **`target`/`srcElement`** | **`which` (deprecated)** |
| -------------- | ------------------- | ------------------------- | ------------------------ |
| click          | 1                   | TBD                       | 1                        |
| contextmenu    | 2 (secondary click) | TBD                       | 3 (legacy right click)   |

Note: Only send the deprecated `which` property if the user agent would normally send it on a non-synthesized mouse event.

Note: The `target` and `srcElement` properties should match the most likely element in the case of a non-synthesized MouseEvent (a real mouse click). Since AT focus targets and pointer event targets do not always align one-to-one, this event property is currently TBD. For example, users agents might attempt to synthesize a pointer event x/y position near the center of the element in AT focus. If hit-testing at that x/y position does not return a descendant of the element in AT focus, user agents might synthesize the event on the element directly in AT focus.



#### KeyboardEvent Object Properties

| **KeyEvent** | **`key`**    | **`code`**   | **`location`**                | **`target`/`srcElement`** |
| ------------ | ------------ | ------------ | ----------------------------- | ------------------------- |
| Escape       | "Escape"     | "Escape"     | DOM_KEY_LOCATION_STANDARD (0) | `document.activeElement`  |
| Left         | "ArrowLeft"  | "ArrowLeft"  | DOM_KEY_LOCATION_STANDARD (0) | `document.activeElement`  |
| Up           | "ArrowUp"    | "ArrowUp"    | DOM_KEY_LOCATION_STANDARD (0) | `document.activeElement`  |
| Right        | "ArrowRight" | "ArrowRight" | DOM_KEY_LOCATION_STANDARD (0) | `document.activeElement`  |
| Down         | "ArrowDown"  | "ArrowDown"  | DOM_KEY_LOCATION_STANDARD (0) | `document.activeElement`  |

The `target` and `srcElement` properties should match `document.activeElement`, which is either the currently focused element or `document.body`.


#### Deprecated KeyboardEvent Object Properties (Optional)

Only send these deprecated properties if the user agent would normally send them on non-synthesized keyboard events.

| **KeyEvent** | **`charCode`** | **`keyCode`** | **`keyIdentifier`**                 | **`keyLocation`** | **`which`** |
| ------------ | -------------- | ------------- | ----------------------------------- | ----------------- | ----------- |
| Escape       | 0              | 27            | U+001B (Unicode Character 'ESCAPE') | 0                 | 27          |
| Left         | 0              | 37            | `Left`                              | 0                 | 37          |
| Up           | 0              | 38            | `Up`                                | 0                 | 38          |
| Right        | 0              | 39            | `Right`                             | 0                 | 39          |
| Down         | 0              | 40            | `Down`                              | 0                 | 40          |


Note: These event property tables are intended to assist implementors during the incubation process. This is not intended as a normative specification.


#### Speculative: New InputEvent types

Note: This section is speculative, as there is now no immediate plan to include InputEvents 
for Assistive Technology Actions.

We will also add some new [`InputEvent`](https://www.w3.org/TR/uievents/#inputevent) types:

- `increment`
- `decrement`
- `dismiss`
- `scrollPageUp`
- `scrollPageDown`

These will be triggered via assistive technology events,
along with the synthesised keyboard events listed in the above table,
and also synthesised when the keyboard events listed above
occur in the context of a valid target for the corresponding assistive technology event.

For example,
if a user not using assistive technology presses the `Escape` key in any context,
an `input` event with a type of `dismiss` will be fired at the focused element
along with the keypress sequence.

If the same user pressed `Up` while page focus was on
a `<input type="range">` _or_ an element with a role of `slider`
(either of which will have a computed role of `slider`),
an `input` event with a type of `increment` will be fired at the focused element
along with the keypress sequence.

#### Use case 3: Listening for events from Assistive Technology

For example:

- A user may be using voice control software and they may speak the name of a
  button somewhere in a web page.
  The voice control software finds the button matching that name in the
  accessibility tree and sends an _action_ to the browser to click on that button.
- That same user may then issue a voice command to scroll down by one page.
  The voice control software finds the root element for the web page and sends
  it the scroll _action_.
- A mobile screen reader user may navigate to a slider, then perform a gesture to
  increment a range-based control.
  The screen reader sends the browser an increment _action_ on the slider element
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

#### Spec/implementation status

Not yet specced or implemented anywhere.

### Virtual Accessibility Nodes

Important note: At this point, due to a number of complications including
privacy concerns, the working group is not pursuing virtual nodes as
intended. Instead, the goal is to focus on alternate solutions to valid
use-cases.

Original idea: **Virtual Accessibility Nodes** would allow authors
to expose "virtual" accessibility nodes,
which are not associated directly with any particular DOM element,
to assistive technology.

This mechanism is often present in native accessibility APIs,
in order to allow authors more granular control over the accessibility
of custom-drawn APIs.

How it could look:

- Calling `attachAccessibleRoot()` causes an `AccessibleNode` to be associated with a `Node`.
  - The returned `AccessibleNode` forms the root of a virtual accessibility tree.
  - The Node's DOM children are implicitly ignored for accessibility once an `AccessibleRoot` is attached - there is no mixing of DOM children and virtual accessible nodes.
- Like `ShadowRoot`, an element may only have one associated `AccessibleRoot`.
- Only `AccessibleNode`s may have `AccessibleNodes` as children,
  and `AccessibleNode`s may only have `AccessibleNode`s as children.

(Again, the current plan is to try to solve use cases without virtual nodes.)

#### Use case 4: Custom-drawn UI

The most common example expressed is canvas-based UI, but there are several
ways that a web app might have custom-drawn UI:

- Canvas with a 2D context
- Canvas with a WebGL context
- SVG
- HTML elements that are used as raw building blocks rather than semantic groupings
- The video element, perhaps the UI is rendered on a remote server and streamed

The challenge is that when the UI is custom-drawn, there aren't any DOM elements
to add ARIA attributes to in order to make it accessible.

The original idea was to use virtual nodes as a solution - create nodes
specifically for accessibility, for example:

```js
// Implementing a canvas-based spreadsheet's semantics
canvas.attachAccessibleRoot();
let table = canvas.accessibleRoot.appendChild(new AccessibleNode());
table.role = "table";
table.colCount = 10;
table.rowcount = 100;
let headerRow = table.appendChild(new AccessibleNode());
headerRow.role = "row";
headerRow.rowindex = 0;
// etc. etc.
```

Virtual nodes would typically need to have location and dimensions set explicitly:

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

#### Privacy concerns

One of the biggest concerns around this proposal is that any events fired
on virtual nodes would be an immediate indication that the user must be
using assistive technology, which is private information that the user
may not want to reveal.

Adding a permission dialog might help if virtual nodes were only truly
needed on a small number of specialized websites, but that would
preclude their use in any widget library.

#### Current thinking

To avoid privacy concerns, the most likely path forwards for custom-drawn
UI will be to promote the use of true DOM elements as fallback content,
with efforts to address weaknesses in this approach, such as:

- Addressing performance issues, perhaps by making it easier to avoid layout for fallback nodes
- New ARIA attributes to allow specifying the accessible bounding box of a node
- New ARIA attributes to decouple the node that has input focus, from the node that is exposed as focused to assistive technology
- New ARIA attributes to make it possible to build a fully custom text editing control

#### Spec/implementation status

Not yet specced or implemented anywhere.

### Full Introspection of an Accessibility Tree - `ComputedAccessibleNode`

This API is still being considered.

It may be approached initially as a testing-only API.

#### Use case 5: Introspecting the computed tree

The **Computed Accessibility Tree** API will allow authors to access
the full computed accessibility tree -
all computed properties for the accessibility node associated with each DOM element,
plus the ability to walk the computed tree structure including virtual nodes.

This will make it possible to:

- write any programmatic test which asserts anything
  about the semantic properties of an element or a page.
- build a reliable browser-based assistive technology -
  for example, a browser extension which uses the accessibility tree
  to implement a screen reader, screen magnifier, or other assistive functionality;
  or an in-page tool.
- detect whether an accessibility property
  has been successfully applied
  (via ARIA or otherwise)
  to an element -
  for example, to detect whether a browser has implemented a particular version of ARIA.
- do any kind of console-based debugging/checking of accessibility tree issues.
- react to accessibility tree state,
  for example, detecting the exposed role of an element
  and modifying the accessible help text to suit.

#### Spec/implementation status

A purely experimental implementation exists in Blink,
via the command-line flag `--enable-blink-features="AccessibilityObjectModel"`.

This adds a method to `Window`, `getComputedAccessibleNode(node)`,
which returns the computed accessible properties for the given node.

This implementation is not reliable and may be removed at any point.

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

- Alex Russell
- Anne van Kesteren
- Bogdan Brinza
- Chris Fleizach
- Chris Hall
- Cynthia Shelley
- David Bolter
- Domenic Denicola
- Elliott Sprehn
- Ian Hickson
- Joanmarie Diggs
- Marcos Caceres
- Meredith Lane
- Nan Wang
- Robin Berjon
- Rossen Atanassov
- Ryosuke Niwa
- Tess O'Connor

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

Both the alternative interface's _output_
(e.g. speech and tones,
updating a [braille display](https://en.wikipedia.org/wiki/Refreshable_braille_display),
moving a [screen magnifier's](https://en.wikipedia.org/wiki/Screen_magnifier) focus)
and _input_
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

These properties and actions are referred to as the _semantics_ of a node.
Each accessibility API expresses these concepts slightly differently,
but they are all conceptually similar.

## Background: DOM tree, accessibility tree and platform accessibility APIs

The web has rich support for making applications accessible,
but only via a _declarative_ API.

The DOM tree is translated, in parallel,
into the primary, visual representation of the page,
and the accessibility tree,
which is in turn accessed via one or more _platform-specific_ accessibility APIs.

![HTML translated into DOM tree translated into visual UI and accessibility tree](images/DOM-a11y-tree.png)

Some browsers support multiple accessibility APIs across different platforms,
while others are specific to one accessibility API.
However, any browser that supports at least one native accessibility API
has some mechanism for exposing a tree structure of semantic information.
We refer to that mechanism, regardless of implementation details,
as the **accessibility tree** for the purposes of this API.

### Mapping native HTML to the accessibility tree

Native HTML elements are implicitly mapped to accessibility APIs.
For example, an `<img>` element will automatically be mapped
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

- Brevity: The name should be as short as possible.
- Clarity: The name should reflect the function of the API,
  without using opaque abbreviations or contractions.
- Generality: The name should not be too narrow and limit the scope of the spec.

Below we've collected all of the serious names that have been proposed
and a concise summary of the pros and cons of each.

Suggestions for alternate names or votes for one of the other names below
are still welcome, but please try to carefully consider the existing suggestions and
their cons first. Rough consensus has already been achieved and we'd rather work
on shipping something we can all live with rather than trying to get the perfect
name.

| Proposed name          | Pros                                                      | Cons                                                                                                        |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Aria`                 | Short; already associated with accessibility              | Confusing because ARIA is the name of a spec, not the name of one node in an accessibility tree.            |
| `AriaNode`             | Short; already associated with accessibility              | Implies the AOM will only expose ARIA attributes, which is too limiting                                     |
| `A11ement`             | Short; close to `Element`                                 | Hard to pronounce; contains numbers; not necessarily associated with an element; hard to understand meaning |
| `A11y`                 | Very short; doesn't make assertions about DOM association | Hard to pronounce; contains numbers; hard to understand meaning                                             |
| `Accessible`           | One full word; not too hard to type                       | Not a noun                                                                                                  |
| `AccessibleNode`       | Very explicit; not too hard to read                       | Long; possibly confusing (are other `Node`s not accessible?)                                                |
| `AccessibleElement`    | Very explicit                                             | Even longer; confusing (are other `Element`s not accessible?)                                               |
| `AccessibilityNode`    | Very explicit                                             | Extremely long; nobody on the planet can type 'accessibility' correctly first try                           |
| `AccessibilityElement` | Very explicit                                             | Ludicrously long; still requires typing 'accessibility'                                                     |

## Appendix: Partial proposed IDL for virtual accessibility nodes

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

## Appendix: partial proposed IDL for `ComputedAccessibleNode`

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

```idl
partial interface Window {
  [NewObject] ComputedAccessibleNode getComputedAccessibleNode(Element el);
}
```
