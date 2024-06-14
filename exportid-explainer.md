> [!CAUTION]  
> The Export ID proposal is no longer planned. It has been replaced by the [Reference Target](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/reference-target-explainer.md) proposal.

# Exporting IDs from shadow roots for cross-root ARIA

Authors: [Ben Howell](https://github.com/behowell), [Alice Boxhall](https://github.com/alice)

## Introduction

The Shadow DOM provides a powerful way to encapsulate web components and keep their implementation details separate from other code on the page. However, this presents a problem for accessibility, which needs to establish semantic relationships between elements on the page. There is currently no way to refer to an element inside another shadow tree from an attribute like `aria-labelledby`. Referring to elements across shadow root boundaries is called "cross-root ARIA", although it affects non-ARIA properties like the label's `for` attribute as well.

For more detailed background on the problem and other proposals to solve it, see Alice Boxhall's article [How Shadow DOM and accessibility are in conflict](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/).

As laid out in the article, there are separate but related problems to solve:

* [Referring into Shadow DOM](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-into-shadow-dom): An element in the light tree needs to create a relationship like `aria-activedescendant` to an element inside a shadow tree.
* [Referring from Shadow DOM outwards](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#referring-from-shadow-dom-outwards): An element inside a shadow tree needs to create a relationship like `aria-labelledby` with an element in the light tree.
* There is also the combined case, where an element in one shadow tree needs to refer to an element in a sibling shadow tree (or any relationship that is not a direct ancestor/descendant relationship). A complete solution should work in this case as well.
  * An example of when this is needed is described by Nolan Lawson: [ARIA element reflection across non-descendant/ancestor shadow roots](https://github.com/WICG/aom/issues/192).

The cross-root ARIA problem has been discussed for several years, and there have been many proposed solutions. Existing proposals are described below, in the **Alternative Solutions** sections. This proposal draws on the ideas from many of the other proposals.

## Proposal: Exported IDs

The `exportid` attribute is a way to allow an element inside a shadow tree to be referred to via an ID reference attribute like `aria-labelledby` or `for`, while preserving shadow DOM encapsulation.

**Goals**

* Create a mechanism for elements to refer to each other across shadow root boundaries through ID reference attributes like `aria-labelledby` or `for`.
* The solution should work the same for both closed and open shadow roots.
* Shadow DOM encapsulation should be preserved: Exporting an ID doesn't directly allow access to the underlying element. It is still required to have access to the shadow root to get the element.
* The solution should allow creating references across multiple nested shadow roots,
and across "sibling" shadow roots
(i.e. from an element within one shadow root,
to an element within a shadow root attached to an element in the light tree of the first shadow root).
* The solution should be serializable, i.e. expressible in HTML only.

**Non-Goals**

* Exported IDs are not available for CSS styling. That is the role of shadow parts.
* This proposal does not help with ARIA attributes that aren't ID references, such as `aria-label`.


## Referring to elements in a shadow tree

A new boolean attribute `exportid` specifies that an element is able to be referenced from outside of its shadow tree in attributes that support ID references.

Elements outside of the shadow tree can refer to an exported ID with the syntax `"thehost::id(thechild)"`. In this example, `"thehost"` is the ID of the element that contains the shadow root, and `"thechild"` is the ID of an element inside the shadow tree that also has `exportid`. See the example below.

Exported ID references can be used in any attribute that refers to an element by ID, such as `for` or `aria-labelledby`.

#### Example 1: Referring into the shadow tree using exportid

```html
<label for="security::id(real-input)">What was the name of your first pet?</label>
<x-input id="security">
  #shadowRoot
  | <input id="real-input" exportid />
</x-input>
```

> Note: See the [Requirements for `exportid`](#requirements-for-exportid) section for details on `id` values used with `exportid`.

### Forwarding exported IDs

For the relatively uncommon case of nested shadow roots, IDs can be "forwarded" from the outer shadow root using the `forwardids` attribute,
analogous to how CSS `part`s may be exported via [`exportparts`](https://drafts.csswg.org/css-shadow-parts/#exportparts-attr).

> Note: It is not allowed to chain together multiple `::id()` values to refer into a nested shadow tree. For example, the following is not valid, and would not match anything: `for="x-combobox::id(x-input)::id(the-input)"`. This is to avoid exposing more structure than a component author may desire, and follows the same restrictions as the CSS `::part()` selector.

#### Example 2: Referring through multiple layers of shadow trees

```html
<label for="airports::id(real-input)">Destination:</label>
<x-combobox id="airports">
  #shadowRoot
  | <x-input id="textbox" forwardids="real-input">
  |   #shadowRoot
  |   | <input id="real-input" exportid />
  | </x-input>
  | <x-listbox></x-listbox>
</x-combobox>
```

Multiple IDs can be forwarded, separated by a comma; e.g. `forwardids="id1, id2"`.

Forwarded IDs can also optionally be renamed: `forwardids="name1, inner-name2: outer-name2"`.

#### Example 3: Renaming an exported ID to avoid a collision

```html
<!-- The <label> elements slotted in to the <x-address>
     use aliased forwarded IDs for the inner <input>s. -->
<x-address id="address">
  #shadowRoot
  | <slot name="street-address-label"></slot>
  | <x-input id="street" forwardids="real-input: street-input">
  |   #shadowRoot
  |   | <input id="real-input" exportid>
  | </x-input>
  | <slot name="city-label"></slot>
  | <x-input id="city" forwardids="real-input: city-input">
  |   #shadowRoot
  |   | <input id="real-input" exportid>
  | </x-input>
  #/shadowroot
  <label for="address::id(street-input)">Street address:</label>
  <label for="address::id(city-input)">City:</label>
</x-address>
```

## Referring out of the shadow tree with `useids`

A much more common need is to refer from a shadow tree out into the light tree.
This is already possible using [reflected `Element` IDL attributes](https://html.spec.whatwg.org/#reflecting-content-attributes-in-idl-attributes:element), e.g. `shadowInput.ariaDescribedByElement = lightDiv;`.
However, this can't be serialized, and doesn't allow referring into "sibling" shadow roots.

The `useids` attribute "imports" IDs from the light tree into a shadow tree, via a mapping from `inner-id: outer-idref`.
The `inner-id` names are determined by the web component author, much like a `slot` name;
the `outer-idref` names are provided by the user of the web component to refer to some specific element outside the component.

Within the component's shadow tree, imported IDs are referenced using the `:host::id()` syntax, using the special 'ID' `:host` to refer to IDs specified by `useid` on the host element. This syntax is analagous to the `:host::part()` CSS selector that can be used to select parts in the local tree.

Note: There is an open question below discussing an [alternative syntax for useids](#open-question-useids).

#### Example 4: Importing IDs with `useids`

This example shows how to import an ID called `"hint"` into the `<x-input-with-hint>` component, and reference it using the `":host::id()"` syntax.

```html
<x-input-with-hint id="name" useids="hint: name-hint">
  #shadowRoot
  | <input aria-describedby=":host::id(hint)" id="real-input" exportid>
</x-input-with-hint>
<span id="name-hint">Your name can be in any language.</span>
```

<!-- Comment from Alice: I'm not sure exactly how valuable this is either as a functionality or an example.
     Couldn't you achieve the same thing (albeit with more verbosity) by importing each ID separately?

#### Example 4a: Referring to multiple IDs via a single imported ID

Some attributes like `aria-labelledby` allow multiple IDs to be specified in their values: `aria-labelledby="label-1 label-2"`. If a useid definition contains multiple whitespace-separated IDREFs, then those IDs are all applied to the attribute.

The value of an imported ID can be a space-separated
While it is possible to achieve the same result using multiple imported IDs, that requires the component to be specifically authored to support multiple IDs

In the following example, the computed description for the `<input>` is "Please enter a name. Your name can be in any language."

```html
<x-input useids="hint: name-error name-hint">
  #shadowRoot
  | <span id="span-3">Three</span> 
  | <input aria-describedby=":host::id(hint)" />
</x-input>
<span id="name-error">Please enter a name.</span>
<span id="name-hint">Your name can be in any language.</span>
```

-->

### Referring across sibling shadow trees

When using `useids`, `outer-idref` values may be straightforward IDs,
but also may use the `::id()` syntax to refer into sibling shadow roots.

#### Example 5: `<label>` and `<input>` in separate shadow trees

In this example, both the `<label>` and `<input>` are inside sibling shadow trees.
The `<label>` uses `useids` and the `::id()` syntax to connect the two.

```html
<x-label useids="label-for: gender::id(real-input)">
  #shadowRoot
  | <label for=":host::id(label-for)">Gender</label>
</x-label>
<x-input id="gender">
  #shadowRoot
  | <input id="real-input" exportid />
</x-input>
```

#### Example 6: A kitchen sink example: Contact Picker

This is a more complex example utilizing several different features of exported/imported IDs.
* The **x-contact-picker** component contains an **x-input** and an **x-listbox** component.
* The **x-input** has `forwardids="real-input"` so that the label's `for` attribute can refer to the input element.
* The **x-input** uses two imported ids: `selected-contact` and `contact-listbox`.
  They are each mapped to an element inside the **x-listbox**'s shadow tree.

```html
<label for="contacts::id(real-input)">To:</label>
<x-contact-picker id="contacts">
  #shadowRoot
  | <x-input
  |   forwardids="real-input"
  |   useids="contact-listbox: people::id(real-listbox),
  |           selected-contact: people::id(opt1)">
  |   #shadowRoot
  |   | <input
  |   |   role="combobox"
  |   |   id="real-input" exportid
  |   |   aria-controls=":host::id(contact-listbox)"
  |   |   aria-activedescendant=":host::id(selected-contact)"
  |   |   aria-expanded="true"
  |   | />
  | </x-input>
  | <button aria-label="Open" aria-expanded="true">v</button>
  |
  | <x-listbox id="people">
  |   #shadowRoot
  |   | <div role="listbox" id="real-listbox" exportid>
  |   |    <div role="option" id="opt1">fish@marine.animals</div>
  |   |    <div role="option" id="opt2">octopus@ocean.creatures</div>
  |   | </div>
  | </x-listbox>
</x-contact-picker>
```

## JavaScript APIs

Supporting exported and imported IDs in JavaScript requires several new APIs and updates to existing APIs.

### `Element.exportId` property

A boolean property that reflects the `exportid` attribute.

### `Element.forwardIds` property

Since `forwardids` represents a mapping from an internal ID to a (potentially renamed) external ID,
it's reflected as a [`DOMStringMap`](https://developer.mozilla.org/en-US/docs/Web/API/DOMStringMap).
This also makes it easier to add and remove IDs from the set of forwarded IDs.

This is similar in function to the [`dataset` property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset), except that kebab-case IDs are _NOT_ converted to camelCase. All imported ID names are attributes as-is, and may need to be accessed using the `['']` syntax instead of the dot `.` syntax if they contain hyphens.

#### Example 7: The `forwardIds` property

```html
<x-multi-slider id="minmax" forwardids="track, low: min, high: max">
  #shadowRoot
  | <div>
  |   <span id="track"></span>
  |   <span id="low" exportid></span>
  |   <span id="high" exportid></span>
  | </div>
</x-multi-slider>
<script>
  const minmax = document.getElementById('minmax');
  console.log(minmax.forwardIds); // { 'track': 'track', 'low': 'min', 'high': 'max' }

  // change one of the names
  minmax.forwardIds['low'] = 'minimum';

  // delete one of the forwarded IDs
  delete minmax.forwardIds['track'];
</script>
```

### `Element.useIds` property

Likewise, `useids` is reflected as a [`DOMStringMap`](https://developer.mozilla.org/en-US/docs/Web/API/DOMStringMap) IDL attribute,
without converting IDs to camelCase.

#### Example 8: The `useIds` property

```html
<x-input id="contact-input"
         useids="contact-listbox: people,
                 selected-contact: people::id(opt1)">
<script>
  const contactInput = document.getElementById('contact-input');
  console.log(contactInput.useIds['contact-listbox']); // 'people'
  console.log(contactInput.useIds['selected-contact']); // 'people::id(opt1)'

  contactInput.useIds['contact-listbox'] = 'some-other-listbox';
  delete xInput.useIds['selected-contact'];

  // Changes are reflected back to the attribute
  console.log(xInput.getAttribute('useids')); // 'contact-listbox: some-other-listbox'
</script>
```

### Properties that reflect IDREF attributes as strings

Exported ID references work as expected when setting or getting them on DOMString properties like [`HTMLLabelElement.htmlFor`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/htmlFor). The `::id()` syntax will continue to work as it does when setting the attributes in HTML markup.

```js
myLabel.htmlFor = 'x-input-1::id(input-2)';
console.log(myLabel.htmlFor); // 'x-input-1::id(input-2)'
```

### IDL attributes that reflect IDREF attributes as Element objects

To preserve encapsulation of the shadow DOM, reflected IDL attributes which return element references (such as [`HTMLInputElement.labels`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels) or [`Element.ariaActiveDescendantElement`](https://w3c.github.io/aria/#dom-ariamixin-ariaactivedescendantelement)) cannot return direct references to elements referred to by exported IDs, since those elements may be inside shadow trees that are not accessible to the caller.

When accessing a property that refers to an element inside another shadow tree (using `::id()`), the returned element will be [retargeted](https://dom.spec.whatwg.org/#retarget) in the same way that's done for event targets in shadow DOM. In practice, this is typically the **host element** (i.e. the element specified before `::id()`), but it is more complex when using `useids`.

> **Note**: This solution borrows from Alice Boxhall's recommendation for [Encapsulation-preserving IDL Element reference attributes](https://github.com/WICG/aom/issues/195).

#### Example 9: Getting `htmlFor` which refers to an element inside a shadow root

```html
<label for="airports::id(real-input)">Destination:</label>
<x-combobox id="airports">
  #shadowRoot
  | <x-input id="textbox" forwardids="real-input">
  |   #shadowRoot
  |   | <input id="real-input" exportid />
  | </x-input>
  | <x-listbox></x-listbox>
</x-combobox>
<script>
console.log(document.querySelector('label').htmlFor);
// logs the <x-combobox id="airports"> element
</script>
```

#### `getElementById`

We do not want `getElementById('host-id::id(child)')` to be a way to break encapsulation of the shadow DOM and access elements inside a shadow root. As such, it can't return the child element. The two basic options are:
1. **PROPOSED**: Return `null` as this is not an exact match for an ID.
   - **Pros**: The "safe" option, as it does not modify the current behavior of `getElementById`. It has parity with `querySelector` discussed below.
   - **Cons**: Makes `getElementById` useless with exported IDREFs. Also, it means the following two are not the same:
      ```js
      const byId = document.getElementById(el.getAttribute('aria-activedescendant')); // = null
      const byAttr = el.activeDescendantElement; // = the host element
      ```
2. Return the shadow host of the target element, using the [retargeting](https://dom.spec.whatwg.org/#retarget) algorithm.
   - **Pros**: Parity with IDREF attributes like `ariaActiveDescendantElement`.
   - **Cons**: It is potentially confusing that the ID of the returned element doesn't match the ID passed in.

The proposal is to use option 1 (return `null`); see [Example 10](#example-javascript-props) below. It may be possible to support option 2 later by adding an argument like `getElementById(id, { includeExportId: true })`. There is an open question below that discusses [other alternatives for getElementById](#open-question-getelementbyid) as well. However, any modification to `getElementById` would likely need to have a good motivating example.

#### `querySelector`/`querySelectorAll`

Exported IDs are NOT allowed to be used as CSS selectors, which means that `querySelector` and `querySelectorAll` will always return `null` when used with an exported IDREF.

<a id="example-javascript-props"></a> 

#### Example 10: Accessing exported IDs by JavaScript properties 

This is a simplified combobox example, to show the various methods of accessing the `aria-activedescendant` element.

```html
<input id="combo-textfield" role="combobox" aria-activedescendant="combo-listbox::id(opt1)" />

<x-listbox id="combo-listbox">
  #shadowRoot
  | <div role="listbox">
  |   <div role="option" id="opt1" exportid>Peaches</div>
  |   <div role="option" id="opt2" exportid>Plums</div>
  | </div>
</x-listbox>

<script>
  const combobox = document.getElementById('combo-textfield');

  console.log(combobox.getAttribute('aria-activedescendant'));
  // "combo-listbox::id(opt1)"

  console.log(combobox.ariaActiveDescendantElement);
  // <x-listbox id="combo-listbox"> (Note this is the HOST element)

  console.log(document.getElementById("combo-listbox::id(opt1)"));
  // null

  console.log(document.querySelector("#combo-listbox::id(opt1)"));
  // null

  // If the shadow root is open (or the code has access to the shadowRoot in another way),
  // then the actual element can be accessed like so.
  // Note: this is not a new proposed feature; it works prior to this proposal.
  console.log(document.getElementById('combo-listbox').shadowRoot.getElementById('opt1'));
  // <div role="option" id="opt1" exportid>Peaches</div>
</script>
```

### Requirements for `exportid`

The element with `exportid` must also have an `id` that conforms to a more strict rules about what characters are allowed. Normally, [IDs are allowed to have any character except whitespace](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id). For `exportid` to work, the `id` can only have letters, numbers, underscores, and hyphens (regex for permitted names: `[A-Za-z0-9_-]+`).

#### Example 11: Invalid uses of `exportid`

```html
<x-input> <!-- Warning: The host must have an ID for elements inside to be referenced by exportid. -->
  #shadowRoot
  | <!-- Error: exportid requires an ID to be specified -->
  | <input exportid />
  |
  | <!-- Error: Although this is a valid ID, it can't be exported because it contains colons and parentheses. -->
  | <input id="::id(example)" exportid />
</x-input>
```

#### Example 12: Exact ID name matches win

It is technically possible (though not recommended) that _another_ element could have an `id` that contains `::id(...)`, since colon and parentheses are valid characters in an ID. Referring to those elements by ID will continue to work as normal. The lookup algorithm will first check if there is an element with an exact ID match before trying to parse out the export ID syntax.

```html
<label for="x-input-1::id(the-input)">Example Label</label>

<!-- The label applies to THIS input because its ID is an exact match. -->
<input id="x-input-1::id(the-input)" />

<x-input id="x-input-1">
  #shadowRoot
  | <!-- This label does NOT apply to this input. -->
  | <input id="the-input" exportid />
</x-input>
```

## Privacy and Security Considerations

No considerable privacy or security concerns are expected, but community feedback is welcome.

## Alternative Solutions

### Other proposals for cross-root ARIA

There have been a number of solutions proposed to allow referring to elements inside the shadow DOM. In general, they fall into one of two categories: either changing how attribute lookups work, or changing how ID reference lookup works.

#### Attribute lookup changes

In these solutions, attributes on the host element like `aria-labelledby` are delegated to an element inside the shadow tree. The delegate element is chosen by the author of the web component (not the user).

Proposals in this category include:
- [Cross-root ARIA delegation](https://github.com/leobalter/cross-root-aria-delegation/blob/main/explainer.md) by [Leo Balter](https://github.com/leobalter) and [Manuel Rego](https://github.com/mrego)
- [Cross-root ARIA reflection](https://github.com/Westbrook/cross-root-aria-reflection/blob/main/cross-root-aria-reflection.md) by [Westbrook Johnson](https://github.com/Westbrook/)
- [Semantic Delegate](https://github.com/alice/aom/blob/gh-pages/semantic-delegate.md) by [Alice Boxhall](https://github.com/alice)

**Pros**
- Simple for the user: attributes on the custom component "just work" without needing additional knowledge of the component.
- Does not expose any component internals outside of the shadow tree.

**Cons**
- The bottleneck effect: there can only be one value for a delegated attribute in the shadow DOM. For example, there's no way for a range slider component, which has two input elements (min and max), to have separate labels for each input: the same `aria-labelledby` would apply to each input.
- The component is in charge of picking the target of an attribute. For example, in the case of `aria-activedescendant`, it's up to the component to internally track the active descendant, and re-delegate the attribute to the correct element.
- Potentially confusing which attributes are delegated; and it's not necessarily consistent between web components.

#### ID lookup changes

Provide a way for users to directly target elements in the shadow tree.

Proposals in this category include:
  - [Content attribute to import/export IDs across shadow boundaries](https://github.com/WICG/aom/issues/169) by [Ryosuke Niwa](https://github.com/rniwa)
  - [Using ::part](https://alice.pages.igalia.com/blog/how-shadow-dom-and-accessibility-are-in-conflict/#part) by [Alice Boxhall](https://github.com/WICG/aom/issues/195) (?)
  - [The globalid attribute](https://gist.github.com/alice/54108d8037f865876702b07755f771a5#special-guids) by [Brian Kardell](https://github.com/bkardell)
  - [Encapsulation-preserving IDL Element reference attributes](https://github.com/WICG/aom/issues/195) by [Alice Boxhall](https://github.com/WICG/aom/issues/195) and [Nolan Lawson](https://github.com/nolanlawson)
  - [Element Handles](https://github.com/WICG/aom/pull/200) by [Ben Howell](https://github.com/behowell)
  - This proposal: Exported IDs

**Pros**
- No bottleneck effect: different elements in the same shadow DOM can have different values for the same attribute (e.g. two inputs in the shadow DOM can have two different `aria-labelledby` values).
- Re-targeting an attribute like `aria-activedescendant` can be handled by either the developer using the component (by changing the value of `aria-activedescendant`) OR by the component author (by internally moving names to different elements).

**Cons**
- Increased complexity when using a component: need to know some details about the internals of the component to target the correct element (can be published with documentation for the web component).

## Open Questions

### Is the syntax too verbose?

The specifics of the syntax will likely be a long-tail discussion of this proposal. Some early feedback for this proposal has centered around the verbosity of the syntax:

* The `::id()` part of the IDREF is not strictly necessary.
   * For example: `host-1::id(child-2)` could instead be shortened to `host-1::child-2`, or `host-1/child-2`.
* The `:host` selector for imported IDs (via `useid`) may be surpurflous.
   * Imported IDs could start with `::`, or `../`, etc.: `aria-labelledby="::my-imported-id"`.

The verbosity of the syntax has some **Pros**:
* **Clarity**: more obvious that this is "special" syntax, and not just a developer's naming convention.
* **Learnability**: It is easier to search for "What does ::id mean?" instead of "What does :: mean?"
* **Less likely for ID collisions**: Since this new syntax is being added to the same namespace as IDs, it could help to use a syntax that is unlikely to exist in any current website's IDREFs.

There are also **Cons**:
* **Page size**: Boilerplate text increases the size of the page source code. This affects the transfer time over the wire, but that can be mitigated by compression like gzip. It could also and parsing time/memory consumption, but the effects there may be negligible.
* **Confusion**: The similarities to CSS selectors may indicate that other CSS-like selectors could be used in IDREFs. Also, the syntax is not exactly the same as CSS (e.g. no `#` before the id part: `#host-1::id(child-2)`).
* **More to type**: More keystrokes could be annoying after a while.

<a id="open-question-useids"></a>

### Could the syntax for `useids` be improved?

The `useids` attribute is a part of the public API of a web component, and will be added every time a web component is _used_ (rather than once when the web component is _authored_). As proposed, the value for `useids` is a (potentially long) comma-separated string of name-value pairs. This could be cumbersome for web component users, especially if the string needs to be programmatically generated and/or parsed.

The `Element.useIds` attribute makes the value easier to manage from JavaScript, but it does not help when the values are written in HTML markup, or if markup is generated by a script.

One possible alternative is to declare a family of attributes that begin with `useid-*` or `id-*`, conceptually similar to the `data-*` attributes. Each would declare one custom ID to import to the component. Then, they would be referenced from inside the component with syntax such as `":host[useid-example-import]"`, or `":host::useid(example-import)"`.

For example:

```html
<x-comboboxinput
  useid-labelexample="my-label"
  useid-activeitem="x-listbox-1::id(opt1)"
  useid-dropdownlistbox="x-listbox-1"
>
  #shadowRoot
  | <input
  |   role="combobox"
  |   aria-labelledby=":host[useid-labelexample]"
  |   aria-activedescendant=":host[useid-activeitem]"
  |   aria-controls=":host[useid-dropdownlistbox]"
  |   aria-expanded="true"
  | />
</x-comboboxinput>
```

The equivalent with the `useids` as proposed above would look like this:
```html
<x-comboboxinput
  useids="labelexample: my-label, activeitem: x-listbox-1::id(opt1), dropdownlistbox: x-listbox-1"
>
  #shadowRoot
  | <input
  |   role="combobox"
  |   aria-labelledby=":host::id(labelexample)"
  |   aria-activedescendant=":host::id(activeitem)"
  |   aria-controls=":host::id(dropdownlistbox)"
  |   aria-expanded="true"
  | />
</x-comboboxinput>
```

**Pros**
- Each imported ID is a separate attribute, which is a more natural syntax, and is easier to read/write if there are many imported IDs.
- No need to do custom string concatenation or parsing if the values are generated by a script.

**Cons**
- Paraphrasing [a comment by @alice](https://github.com/WICG/aom/pull/200#issuecomment-1692489089): there is no precedent for referencing an _attribute_ in the value of another attribute in HTML. For example `aria-labelledby=":host[useid-labelexample]"` is referencing the value of the host's `useid-labelexample` attribute. This "crosses the streams" between attributes and their values.

<a id="open-question-getelementbyid"></a>

### Does `getElementById` need a way to resolve the exported IDREF syntax?

The proposal above does not have a way for `getElementById('host-1::id(child-2)')` to get the actual child element. We don't want to allow this by default because it would break shadow DOM encapsulation. It is already possible to access the element for open shadow roots using the following:

```js
const host = document.getElementById('host-1');
const child = host.shadowRoot.getElementById('child-2');
```

One possibility is to add an argument to `getElementById`, which is a list of shadow roots that may contain the child element. If the actual element is inside one of the provided shadow roots, then it can be returned directly.

```js
const host = document.getElementById('host-1');
const child = document.getElementById('host::id(child-2)', { shadowRoots: [host.shadowRoot] });
```

The main argument against that is that it's more complicated than the original example that called `host.shadowRoot.getElementById('child-2')`, although it does not require potentially parsing out the child ID from a string like `"host-1::id(child-2)"`.

This feature is something that could be added later in a backwards-compatible way, so it may be best to not include it in the initial Export IDs.