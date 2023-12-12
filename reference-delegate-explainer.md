# Reference Delegate for cross-root ARIA

## Introduction

This explainer describes a solution to the cross-root ARIA problem, which is based heavily on @Westbrook's [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) propsal, as well as borrowing ideas from @alice's [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md) proposal.

For background on the cross-root ARIA problem, see @alice's article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/). The article describes the two main problems that need to be solved: [Referring from Shadow DOM outwards](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-from-shadow-dom-outwards) and [Referring into Shadow DOM](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-into-shadow-dom).

The proposal is to use the existing [**ARIAMixin IDL attributes**](https://w3c.github.io/aria/#ARIAMixin) (such as `ariaLabelledbyElements` and `ariaActiveDescendantElement`) to solve the "Referring from Shadow DOM outwards" problem, and introduce a new feature **Reference Delegate** to solve the "Referring into Shadow DOM" problem, which is compatible with the ARIA.

## Background: Using ARIAMixin to refer out of the shadow DOM

The new proposed Reference Delegate feature is intended to be used alongside ARIAMixin attributes like `ariaLabelledbyElements` and `ariaActiveDescendantElement`. So it's worthwhile giving a brief summary of a way to use of those attributes to allow an element inside the shadow dom refer to the light dom.

Here we define a custom element `<fancy-input>` with custom attributes to define the ARIA relationships for the `<input>` that is in its shadow DOM. This allows the links to be created OUT from the shadow DOM.

<a id="ariamixin-example"></a>

```html
<template id="t-fancy-input">
  <input id="real-input" type="text" />
</template>

<script>
customElements.define("fancy-input", 
  class FancyInput extends HTMLElement {
    static observedAttributes = ["labelledby"];

    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.appendChild(
        document.getElementById("t-fancy-input").content.cloneNode(true));
      this.input_ = this.shadowRoot_.getElementById('real-input');
    }

    attributeChangedCallback(attr, _oldValue, value) {
      if (attr === "labelledby") {
        this.input_.ariaLabelledbyElements = 
          value.split(" ").map(id => this.getRootNode().getElementById(id));
      }
    }
  });
</script>
```

We can use `<fancy-input>` with a label, setting its custom `labelledby` attribute to create an aria association between the `<input id="real-input">` inside the shadow DOM, and the `<label id="label">` in the light DOM.

```html
<label id="label">Fancy input</label>
<fancy-input labelledby="label"></fancy-input>
```

## Proposal: Reference Delegate

A component can specify an element in its shadow tree to act as its "reference delegate". When the host component is the target of a IDREF like a label's `for` attribute, it is forwarded to the delegate.

The shadow root specifies the ID of the delegate element inside the shadow DOM. This is done either in JavaScript with the `ShadowRoot.referenceDelegate = "id-of-target"` attribute, or in markup using the `<template shadowrootreferencedelegate="id-of-target">` attribute.

JavaScript example:

```html
<template id="t-fancy-input">
  <input id="real-input" />
</template>

<script>
customElements.define("fancy-input", 
  class FancyInput extends HTMLElement {
    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.appendChild(
        document.getElementById("t-fancy-input").content.cloneNode(true));
      this.shadowRoot_.referenceDelegate = "real-input";
    }
  });
</script>

<label for="fancy-input">Fancy input</label>
<fancy-input id="fancy-input"></fancy-input>
```

Equivalent with declarative shadow DOM:

```html
<label for="fancy-input">Fancy input</label>
<fancy-input id="fancy-input">
  <template shadowrootmode="closed"
            shadowrootreferencedelegate="real-input">
    <input id="real-input" />
  </template>
</fancy-input>
```

### Delegating different reference types to different elements

There are situations where it is necessary to delegate different reference types to different elements. For example, a listbox may want to delegate `aria-controls` to its root, and `aria-activedescendant` to one of the items inside the listbox.

The `ShadowRoot.referenceDelegateMap` attribute allows for specifying elements based on the attribute that is being used to reference the host.

The equivalent declaractive attribute is `shadowrootreferencedelegatemap`, which is a comma-separated list of attribute to ID mappings.

```html
<label for="input">Combobox with a fancy listbox</label>
<input id="input" aria-controls="fancy-listbox" aria-activedescendant="fancy-listbox" />
<fancy-listbox id="fancy-listbox">
  <template shadowrootmode="closed"
            shadowrootreferencedelegatemap="aria-controls: real-listbox,
                                            aria-activedescendant: option-2">
    <div id="real-listbox" role="listbox">
      <div id="option-1" role="option">Option 1</div>
      <div id="option-2" role="option">Option 2</div>
    </div>
  </template>
</fancy-listbox>
```

Declaring the mappings using the JavaScript API would look like:
```js
this.shadowRoot_.referenceDelegateMap['aria-controls'] = 'real-listbox';
this.shadowRoot_.referenceDelegateMap['aria-activedescendant'] = 'option-2';
```

#### Combining `referenceDelegate` and `referenceDelegateMap`

In the case where both attributes are specified, `referenceDelegateMap` takes priority for individual attributes, and `referenceDelegate` acts as the fallback for attributes that are not specified.

In the example below, `"real-listbox"` is the delegate for all attributes _except_ `aria-activedescendant`, which is delegated to `"option-2"`.

```html
<label for="input">Combobox with a fancy listbox</label>
<input id="input"
       aria-controls="fancy-listbox"
       aria-activedescendant="fancy-listbox" />
<fancy-listbox id="fancy-listbox">
  <template shadowrootmode="open"
            shadowrootreferencedelegate="real-listbox"
            shadowrootreferencedelegatemap="aria-activedescendant: option-2">
    <div id="real-listbox" role="listbox">
      <div id="option-1" role="option">Option 1</div>
      <div id="option-2" role="option">Option 2</div>
    </div>
  </template>
</fancy-listbox>
```

#### Delegating to multiple elements

Some attributes such as `aria-labelledby`, `aria-describedby`, etc. support multiple targets. Mappings for those attributes support a space-separated list of IDs.

This example shows a `<description-with-tooltip>` component that contains a "More Info" button to show the tooltip, but is not intended to be included in the description text. So it delegates `aria-describedby: message tooltip` to forward to only the content that should be included in the description text.

```html
<input aria-describedby="description-with-tooltip" />
<!--
  The resulting description text is: 
  "Inline description text. Tooltip with more information."
-->
<description-with-tooltip id="description-with-tooltip">
  <template shadowrootmode="closed"
            shadowrootreferencedelegatemap="aria-describedby: message tooltip">
    <div>
      <span id="message">
        Inline description text.
      </span>
      <button onmouseover="showTooltip()" onmouseout="hideTooltip()">
        More Info
      </button>
      <div id="tooltip" role="tooltip" style="display: none">
        Tooltip with more information.
      </div>
    </div>
  </template>
</description-with-tooltip>
```

### List of delegated attributes

These are the attributes that can be delegated to an element inside the tree.

* `aria-activedescendant`
* `aria-controls`
* `aria-describedby`
* `aria-details`
* `aria-errormessage`
* `aria-flowto`
* `aria-labelledby`
* `aria-owns`
* `for`
* (Please let me know if there are any missing)

## Considered Alternatives

### Alternative names for the feature "Reference Delegate"

The name "reference delegate" (`shadowrootreferencedelegate`) is intended to indicate that the specified element acts as the delegate for references to the host element. Some possible alternative names:
* "Delegates References" - `shadowrootdelegatesreferences="id"` - more similar wording to `shadowrootdelegatesfocus`.
* "Reflects References" - `shadowrootreflectsreferences="id"` - borrowing from the [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) propsal.
* "Forwards References" - `shadowrootforwardsreferences="id"` - borrowing from ["forwardRef" in React](https://react.dev/reference/react/forwardRef).

### Use separate attributes for each forwarded attribute

An alternative to a single attribute `shadowrootreferencedelegatemap` / `ShadowRoot.referenceDelegateMap` would be to have individual attributes for each forwarded attribute:
* `shadowrootdelegatesariaactivedescendant="id"`
* `shadowrootdelegatesariacontrols="id"`
* `shadowrootdelegatesariadescribedby="id"`
* `shadowrootdelegatesariadetails="id"`
* `shadowrootdelegatesariaerrormessage="id"`
* `shadowrootdelegatesariaflowto="id"`
* `shadowrootdelegatesarialabelledby="id"`
* `shadowrootdelegatesariaowns="id"`
* `shadowrootdelegatesfor="id"`
* `shadowrootdelegatesreferences="id"` -- all other references except the ones specified above

Reflected by JavaScript attributes `ShadowRoot.delegatesAriaActiveDescendant="id"`, etc.

**Pros**

* Simpler parsing: no need to parse a comma-separated list of colon-separated map entries.
* Works with IDs that contain colons and commas.

**Cons**

* Adds 10+ new attributes instead of 2.
* Much more verbose.
* Less clear(?) that `shadowrootdelegatesreferences` only forwards references that are not explicitly specified by other elements.

### Designate target elements using attributes instead of IDREF

The [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md#usage-with-declarative-shadow-dom) explainer proposes adding attributes to elements inside the shadow tree:
```html
<x-foo id="foo">
  <template shadowroot="open" shadowrootreflectscontrols shadowrootreflectsariaactivedescendent>
    <ul reflectariacontrols>
      <li>Item 1</li>
      <li reflectariaactivedescendent>Item 2</li>
      <li>Item 3</li>
    </ul>
  </template>
</x-foo>
```

**Pros**
* Does not require an ID on the target element. [But does still require an extra attribute; possibly in addition to an ID if that ID is used for other puroposes.]

**Cons**
* Requires new attributes in two places in order to work: E.g. `shadowrootreflectscontrols` on the shadow root _and_ `reflectariacontrols` on the target element.
* When multiple elements are used for the same attribute, the author cannot control the order (the order is always the DOM order).

### Use exported IDs instead of per-attribute targeting

The [ExportID explainer](https://github.com/WICG/aom/blob/gh-pages/exportid-explainer.md) proposes a way to refer to elements inside the shadow DOM by name. For example, `"fancy-input::id(real-input)"` to refer to a specific `<input>` element inside a `<fancy-input>`.

It would be possible to use exported IDs instead of `referenceDelegateMap` if/when it is necessary to refer to an element other than the primary reference delegate.

**Pros**

* Does not suffer from the [bottleneck effect](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#limitations-of-these-apis).
* Potentially less confusing why you reference the _container_ listbox with `aria-activedescendant` instead of the element itself.

**Cons**

* Exposes some of the internal details of a control, and does not give a way for the control to encapsulate those details.
* Incompatible with ARIAMixin attributes, which don't allow directly referencing elements inside other shadow trees.
   * It may be possible to work around this limitation, but it would require a change to the behavior of the ARIAMixin attributes, as well as new JavaScript APIs to resolve an IDREF like `"fancy-input::id(real-input)"` into an "ElementHandle" type object that references the element without giving full access to it (which would break shadow dom encapsulation).

## Appendix A: Putting it all together with a Combobox Example

This "kitchen sink" example implements a `<fancy-combobox>` using two subcomponents: `<combox-input>` and `<combobox-listbox>`.

#### `<combobox-input>`

This component is a wrapper around an `<input>` for use by a combobox.

1. It delegates all references to the input. This lets, for example, a label for this component to be applied to the input.
2. A custom attribute `listbox` is hooked up to both `ariaControlsElements` and `ariaActiveDescendantElement`.
   * The listbox delegates the two attributes to different elements inside (see `<combobox-listbox>` below), but this component references the parent listbox for both.

```html
<template id="t-combobox-input">
  <input id="real-input" role="combobox" type="text" />
</template>

<script>
customElements.define("combobox-input", 
  class ComboboxInput extends HTMLElement {
    static observedAttributes = ["listbox"];

    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.appendChild(
        document.getElementById("t-combobox-input").content.cloneNode(true));
      this.shadowRoot_.referenceDelegate = "real-input"; // (1)
      this.input_ = this.shadowRoot_.getElementById('real-input');
    }

    attributeChangedCallback(attr, _oldValue, value) {
      if (attr === "listbox") {
        // (2)
        const listbox = this.getRootNode().getElementById(value);
        this.input_.ariaControlsElements = [listbox];
        this.input_.ariaActiveDescendantElement = listbox;
      }
    }
  });
</script>
```

#### `<combobox-listbox>`

This component is a wrapper around `<div role="listbox">` and the `<div role="option">` items inside.

1. It delegates all references _except_ `aria-activedescendant` to the `<div role="listbox">`.
2. It has a custom attribute `activeitem`, which is used to control which item gets the `aria-activedescendant` delegation. This lets the parent component control the active item.

```html
<template id="t-combobox-listbox">
  <div id="real-listbox" role="listbox">
    <div id="option-1" role="option">Option 1</div>
    <div id="option-2" role="option">Option 2</div>
  </div>
</template>

<script>
customElements.define("combobox-listbox", 
  class ComboboxListbox extends HTMLElement {
    static observedAttributes = ["activeitem"];

    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.appendChild(
        document.getElementById("t-combobox-listbox").content.cloneNode(true));
      this.shadowRoot_.referenceDelegate = "real-listbox"; // (1)
    }

    attributeChangedCallback(attr, _oldValue, value) {
      if (attr === "activeitem") {
        this.shadowRoot_.referenceDelegateMap['aria-activedescendant'] = value; // (2)
      }
    }
  });
</script>
```

#### `<fancy-combobox>`

This component combines the two subcomponents above into a combobox.

1. It hooks up the listbox to the input using the `<combobox-input>`'s custom `listbox` attribute.
2. It controls which item inside the listbox is the `aria-activedescendant` of the input using the `<combobox-listbox>`'s custom `activeitem` attribute.
3. It delegates all references to the `"combo-input"` component, which itself delegates to the `"real-input"` inside.

```html
<template id="t-fancy-combobox">
  <combobox-input id="combo-input" 
                  listbox="combo-listbox"> <!-- (1) -->
  </combobox-input>
  <combobox-listbox id="combo-listbox"
                    activeitem="option-1"> <!-- (2) -->
  </combobox-listbox>
</template>

<script>
customElements.define("fancy-combobox", 
  class FancyCombobox extends HTMLElement {
    constructor() {
      super();
      this.shadowRoot_ = this.attachShadow({ mode: "closed" });
      this.shadowRoot_.appendChild(
        document.getElementById("t-fancy-combobox").content.cloneNode(true));
      this.shadowRoot_.referenceDelegate = "combo-input"; // (3)
    }
  });
</script>
```

Using a label's `for` attribute with the fancy-combobox pierces two layers of shadow DOM to apply the label to the `<input id="real-input">`.

```html
<label for="combobox">Combobox</label>
<fancy-combobox id="combobox"></fancy-combobox>
```

## Appendix B: Declarative syntax for referring OUT of the Shadow DOM

### Motivation

Currently, the ARIAMixin attributes like `ariaLabelledByElements` aren't compatible with [Declarative Shadow DOM](https://developer.chrome.com/docs/css-ui/declarative-shadow-dom). 

This presents the following drawbacks:

* Requires a nontrivial amount of code to hook up custom attributes to an element inside the shadow tree. 
   * This increases the chances for bugs or sub-optimal behavior in developer code, and reduces the likelihood that it will be implemented in the first place.
   * In particular: it is difficult to implement in a way that works with nested shadow DOM. [In short: the component needs some way to know what level of nested shadow DOMs to do the `getElementById` lookup.]
* No support for [server-side rendered](https://web.dev/articles/rendering-on-the-web) (SSR) content. Labels will not be available to screen readers until the JavaScript is loaded and executed to hydrate the elements.
* Requires the component to do work to look up and connect `ariaLabelledByElements`, etc. even if no screen reader, etc. is present. [This is a hypothetical perf concern, and may not materialize in practice.]

### Proposal

_This is the beginnings of proposal, and needs more work. It's based on the ideas in the [ExportID proposal](https://github.com/WICG/aom/blob/gh-pages/exportid-explainer.md#could-the-syntax-for-useids-be-improved)._

This adds the following:
* New syntax used in IDREF attributes, which references an attribute on the host element: `":host[attribute-name]"`
* New attribute on the shadow host `shadowrootboundattributes="... ..."`, to opt-in specific attributes for this behavior.

The following example hooks up custom attributes `labelledby` and `listbox` to attributes on the `<input>` inside the custom component.

```html
<combobox-input labelledby="combo-label" listbox="combo-listbox">
  <template shadowrootmode="open"
            shadowrootboundattributes="labelledby listbox">
    <input role="combobox"
           aria-labelledby=":host[labelledby]"
           aria-controls=":host[listbox]"
           aria-activedescendant=":host[listbox]"
    />
</combobox-input>
```

[... more details in progress ...]