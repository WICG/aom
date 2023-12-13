# Reference Delegate for Cross-root ARIA

Author: [Ben Howell](https://github.com/behowell)

## Introduction

Reference Delegate is a new HTML feature to help solve the cross-root ARIA problem. For background on cross-root ARIA, see @alice's article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/). The article describes the two main problems that need to be solved: [Referring from Shadow DOM outwards](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-from-shadow-dom-outwards) and [Referring into Shadow DOM](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-into-shadow-dom).

The Reference Delegate proposal is based heavily on @Westbrook's [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) propsal, as well as borrowing ideas from @alice's [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md) proposal.

A complete solution to cross-root ARIA combines the existing [**ARIAMixin IDL attributes**](https://w3c.github.io/aria/#ARIAMixin) (such as `ariaLabelledbyElements` and `ariaActiveDescendantElement`) to solve the "Referring from Shadow DOM outwards" problem, and introduce a new feature **Reference Delegate** to solve the "Referring into Shadow DOM" problem, which is compatible with the ARIA.

## Proposal

### Reference Delegate

Reference Delegate is a new feature that enables creating ARIA links to elements inside a component's shadow DOM, while maintaining encapsulation of the internal details of the shadow DOM.

**Goals**

- Create a mechanism for ID reference attributes like `aria-activedescendant` and `for` to refer to an element inside a component's shadow DOM.
- Should be compatible with the ARIAMixin attributes such as `ariaActiveDescendantElement`, to create a complete solution to cross-root ARIA.
- Should work the same for both closed and open shadow roots.
- Shadow DOM encapsulation should be preserved: No direct access to any elements inside the shadow tree, and no implementation details leaked into a web component's API.
- Should allow creating references into multiple nested shadow roots, and across "sibling" shadow roots that don't have a direct parent/child relationship.
- The solution should be serializable, i.e. support declarative syntax that is expressible in HTML only.

**Non-Goals**

- This is scoped to only solve the problem of referring _into_ the shadow DOM. It relies on ARIAMixin to refer _out_ of the shadow DOM.
- This proposal does not delegate ARIA attributes that aren't ID references, such as `aria-label`.

### The `referenceDelegate` attribute

A component can specify an element in its shadow tree to act as its "reference delegate". When the host component is the target of a IDREF like a label's `for` attribute, the delegate becomes the true target.

The shadow root specifies the ID of the delegate element inside the shadow DOM. This is done either in JavaScript with the `referenceDelegate` attribute on the `ShadowRoot` object, or in HTML markup using the `shadowrootreferencedelegate` attribute on the `<template>` element.

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

### The `referenceDelegateMap` attribute

There are situations where it is necessary to delegate different reference types to different elements. For example, a listbox may want to delegate `aria-controls` to its root, and `aria-activedescendant` to one of the items inside the listbox.

The `ShadowRoot.referenceDelegateMap` attribute allows for specifying elements based on the attribute that is being used to reference the host.

The equivalent declarative attribute is `shadowrootreferencedelegatemap`, which is a comma-separated list of attribute to ID mappings.

```html
<input role="combobox"
       aria-controls="fancy-listbox"
       aria-activedescendant="fancy-listbox" />
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

> Note: the syntax of `shadowrootreferencedelegatemap` is based on the [`exportparts`](https://drafts.csswg.org/css-shadow-parts/#exportparts-attr) attribute that contains a comma-separated map of part names.

#### Combining `referenceDelegate` and `referenceDelegateMap`

In the case where both attributes are specified, `referenceDelegateMap` takes priority for individual attributes, and `referenceDelegate` acts as the fallback for attributes that are not specified.

In the example below, `"real-listbox"` is the delegate for all attributes _except_ `aria-activedescendant`, which is delegated to `"option-2"`.

```html
<input role="combobox"
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

Some attributes such as `aria-labelledby`, `aria-describedby`, etc. support multiple targets. Using `referenceDelegateMap` with those attributes support a space-separated list of IDs.

This example shows a `<description-with-tooltip>` component that contains a "More Info" button to show the tooltip but is not intended to be included in the description text. It delegates `aria-describedby: message tooltip` to forward to only the content that should be included in the description text.

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

### Supported attributes

This feature is intended to work with **all** attributes that refer to another element by ID string. These are:

* ARIA
  * `aria-activedescendant`
  * `aria-controls`
  * `aria-describedby`
  * `aria-details`
  * `aria-errormessage`
  * `aria-flowto`
  * `aria-labelledby`
  * `aria-owns`
* Inputs
  * `for` (also supports the click behavior of labels)
  * `form`
  * `list`
  * `popovertarget`
  * `invoketarget` (proposed)
  * `interesttarget` (proposed)
* Tables
  * `headers`
* Microdata
  * `itemref`

> _Please comment if there are any attributes missing from this list._

### Interaction with other features

#### Form-associated custom elements

A [form-associated custom element](https://html.spec.whatwg.org/dev/custom-elements.html#form-associated-custom-element) supports being the target of a label's `for` attribute. But if the element has a Reference Delegate for the `for` attribute, then the label applies to the delegate instead. There are no other changes to the behavior of a form-associated custom element.

#### Nesting inside `<label>`

If a shadow tree delegates the `for` attribute (either implicitly with `referenceDelegate` or explicitly with `referenceDelegateMap`), then that also applies when the host element is nested inside a label. The label becomes associated with the reference delegate element.

In the following example, the label of the `<input>` is "Fancy input".

```html
<label>
  Fancy input
  <fancy-input id="fancy-input">
    <template shadowrootmode="closed"
              shadowrootreferencedelegate="real-input">
      <input />
    </template>
  </fancy-input>
</label>
```

> Note: This behavior may need to be reconsidered. It deviates from the rest of the referenceDelegate feature, which only applies to IDREF attributes. It is also possible for authors to use the `for` attribute even when the input is nested inside the label.

#### Nesting inside `<form>`

Reference delegate does not change the behavior of the host element when it is nested inside a form. It does _not_ implicitly associate the delegate element with the form.

> Note: This could be explored further, but it seems like linking the delegate to the form would have too much overlap/conflict with form-associated custom elements.

#### Interaction with JavaScript attributes/functions that reflect Elements

Some JavaScript attributes reflect HTML attributes as Element objects rather than ID strings. These include:
* ARIAMixin attributes like `ariaActiveDescendantElement`
* `HTMLButtonElement.popoverTargetElement`
* `HTMLInputElement.form`
* `HTMLInputElement.labels`
* `HTMLLabelElement.control`
* _(This list is not exhaustive)_

These will _always_ refer to the **host** element that they're targeting, and _never_ the referenceDelegate element directly.  This behavior maintains the design that an [IDL attribute with type Element](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes:element) can only refer to an element that is a descendant of a [shadow-including ancestor](https://dom.spec.whatwg.org/#concept-shadow-including-ancestor) of the element hosting the attribute.

In the example below, `input.ariaActiveDescendantElement` is the `<fancy-listbox>` element that was targeted by `aria-activedescendant="fancy-listbox"`, even though the active descendant is internally delegated to `<div id="option-2">`.

```html
<input id="input" aria-activedescendant="fancy-listbox" />
<fancy-listbox id="fancy-listbox">
  <template shadowrootmode="open"
            shadowrootreferencedelegatemap="aria-activedescendant: option-2">
    <div id="real-listbox" role="listbox">
      <div id="option-1" role="option">Option 1</div>
      <div id="option-2" role="option">Option 2</div>
    </div>
  </template>
</fancy-listbox>

<script>
  const input = document.getElementById('input');
  
  console.log(input.ariaActiveDescendantElement);
  // <fancy-listbox id="fancy-listbox">
</script>
```

#### Interaction with `HTMLInputElement.labels`

The [`HTMLInputElement.labels`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels) attribute returns list of the label elements targeting a certain input element. This API should continue to work if the input element is itself the delegate of a custom element.

```html
<label id="outer-label" for="fancy-input">Outer Label</label>
<fancy-input id="fancy-input">
  <template shadowrootmode="open"
            shadowrootreferencedelegate="real-input">
    <label id="inner-label" for="real-input">Inner Label</label>
    <input id="real-input" />
  </template>
</fancy-input>

<script>
  const fancyInput = document.getElementById('fancy-input');
  const realInput = fancyInput.shadowRoot.getElementById('real-input');

  console.log(realInput.labels); 
  // [<label id="outer-label">, <label id="inner-label">]

  console.log(fancyInput.labels);
  // undefined (`labels` is not an attribute of HTMLElement)
  // If fancyInput were a form-associated custom element, then elementInternals.labels
  // would return an empty list [] because the labels are delegated to realInput.
</script>
```

#### Interaction with CSS Selectors

The referenceDelegate has no interaction with CSS. An ID selector will target the host element, and _not_ its referenceDelegate.

## Privacy and Security Considerations

No considerable privacy or security concerns are expected, but community feedback is welcome.

## Considered Alternatives

This section covers some design alternatives, along with discussion of their Pros and Cons, and why they were not included in the design.

### Alternative names for the feature "Reference Delegate"

The name "reference delegate" (`shadowrootreferencedelegate`) is intended to indicate that the specified element acts as the delegate for references to the host element. Some possible alternative names:
* "Delegates References" - `shadowrootdelegatesreferences="id"` - more similar wording to `shadowrootdelegatesfocus`.
* "Reflects References" - `shadowrootreflectsreferences="id"` - borrowing from the [Cross-root ARIA Reflection API](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) propsal.
* "Forwards References" - `shadowrootforwardsreferences="id"` - borrowing from ["forwardRef" in React](https://react.dev/reference/react/forwardRef).

Ultimately, the name "reference delegate" is the most concise and conveys the intent of the feature. However, community feedback is welcome on the name.

### Omit the "catch-all" `referenceDelegate` attribute

It is technically possible to require all attributes to be individually delegated via `referenceDelegateMap`, rather than also allowing `referenceDelegate` as a "catch-all" for every attribute.

#### Pros

* The main argument to omit `referenceDelegate` is that the semantics could change if more delegated attributes are added in the future. This could break existing websites by changing the target of an attribute, if it is added to `referenceDelegate` support in the future.
* It makes it more difficult for browser vendors to incrementally implement reference delegate, since adding support for additional attributes is a breaking change.

#### Cons

* The Reference Delegate feature is intended to support all attributes that use ID references. Thus, the only time a new attribute will be supported by Reference Delegate is when it is a completely new attribute in the HTML spec. There is no backwards compatibility concern, since no websites will be using the new attribute before is is supported.
* It is beneficial that this feature automatically supports future attributes added to the HTML spec. It will not require any developer work to update to support new features.
* Including an easy-to-use catch-all attribute supports the HTML design principle of [Priority of Constituencies](https://www.w3.org/TR/html-design-principles/#priority-of-constituencies). It priorities users of the feature, over browser implementors and theoretical concerns.

### Add `referenceDelegateElement` attribute that targets an element object

The current API of `referenceDelegate` is a string only, and targets the element by ID. An alternative would be to include an attribute like `referenceDelegateElement`, which allows specifying element objects (without an ID).

```js
const input = document.createElement('input');
this.shadowRoot_.appendChild(input);
this.shadowRoot_.referenceDelegateElement = input;
```

#### Pros

* Makes the API more flexible by not requiring an ID to be added to the target element.

#### Cons

* It requires adding support for [attribute sprouting](https://wicg.github.io/aom/aria-reflection-explainer.html#sprouting-relationship-attributes) to sync the `shadowrootreferencedelegate` attribute with `referenceDelegateElement`. This adds complexity to the spec.
* It does not unlock any net-new functionality. Since `referenceDelegate` only works with elements inside the shadow root, every element that could be a delegate is accessible by a string ID reference.
  > Note: This is in contrast to the ARIAMixin attributes like `ariaLabelledByElements`, which _do_ unlock the new functionality of referring out of the shadow DOM. In that case, the complexity is worthwhile to include in the ARIAMixin design.
* At a basic level, Reference Delegate is augmenting the existing functionality of referring to elements by ID string. It seems in line with the design to require using ID strings.

### Use separate attributes for each forwarded attribute

An alternative to a single attribute `shadowrootreferencedelegatemap` / `ShadowRoot.referenceDelegateMap` would be to have individual attributes for each forwarded attribute:
* `shadowrootariaactivedescendantdelegate`
* `shadowrootariacontrolsdelegate`
* `shadowrootariadescribedbydelegate`
* `shadowrootariadetailsdelegate`
* `shadowrootariaerrormessagedelegate`
* `shadowrootariaflowtodelegate`
* `shadowrootarialabelledbydelegate`
* `shadowrootariaownsdelegate`
* `shadowrootfordelegate`
* `shadowrootformdelegate`
* `shadowrootlistdelegate`
* `shadowrootpopovertargetdelegate`
* `shadowrootinvoketargetdelegate`
* `shadowrootinteresttargetdelegate`
* `shadowrootheadersdelegate`
* `shadowrootitemrefdelegate`
* `shadowrootreferencedelegate` -- all other references except the ones specified above

Reflected by JavaScript attributes `ShadowRoot.ariaActiveDescendantDelegate`, etc.

#### Pros

* Syntax is more in line with other HTML attributes, rather than using a comma-separated list of colon-separated map entries.
* Works with IDs that contain commas.

#### Cons

* Adds 15+ new attributes instead of 2.
* Less clear(?) that `shadowrootreferencedelegate` only forwards references that are not explicitly specified by other elements.

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

#### Pros

* Does not require an ID on the target element. [But does still require an extra attribute; possibly in addition to an ID if that ID is used for other purposes.]

#### Cons

* Requires new attributes in two places in order to work: E.g. `shadowrootreflectscontrols` on the shadow root _and_ `reflectariacontrols` on the target element.
* When multiple elements are used for the same attribute, the author cannot control the order (the order is always the DOM order).

### Use exported IDs instead of per-attribute targeting

The [ExportID explainer](https://github.com/WICG/aom/blob/gh-pages/exportid-explainer.md) proposes a way to refer to elements inside the shadow DOM by name. For example, `"fancy-input::id(real-input)"` to refer to a specific `<input>` element inside a `<fancy-input>`.

It would be possible to use exported IDs instead of `referenceDelegateMap` if/when it is necessary to refer to an element other than the primary reference delegate.

#### Pros

* Does not suffer from the [bottleneck effect](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#limitations-of-these-apis).
* Potentially less confusing why you reference the _container_ listbox with `aria-activedescendant` instead of the element itself.

#### Cons

* Exposes some of the internal details of a control and does not give a way for the control to encapsulate those details.
* Incompatible with ARIAMixin attributes, which don't allow directly referencing elements inside other shadow trees.
   * It may be possible to work around this limitation, but it would require a change to the behavior of the ARIAMixin attributes, as well as new JavaScript APIs to resolve an IDREF like `"fancy-input::id(real-input)"` into an "ElementHandle" type object that references the element without giving full access to it (which would break shadow DOM encapsulation).

## Appendix A: Combobox Example

This "kitchen sink" example implements a `<fancy-combobox>` using two subcomponents: `<combobox-input>` and `<combobox-listbox>`. It demonstrates:
* Delegating references through multiple layers of shadow DOM.
   * A label in the light DOM refers to the `<input>` inside the `<combobox-input>`, which is itself inside the `<fancy-combobox>`.
* Referring to an element in a sibling shadow tree. 
   * Uses `ariaActiveDescendantElement` in `<combobox-input>` along with `referenceDelegateMap` in `<combobox-listbox>` to connect the `<input>` with a `<div role="option">`.
* Using a custom prop to control the target of `referenceDelegateMap`.
   * `<combobox-listbox>` allows the target of its `aria-activedescendant` to be controlled externally via its custom `activeitem` attribute.

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

1. It delegates all references _except_ `aria-activedescendant` to the `<div role="listbox">` using `referenceDelegate`.
2. It has a custom attribute `activeitem`, which is used to control which item gets the `aria-activedescendant` delegation using `referenceDelegateMap`. This lets the parent component control the active item.

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
