# ARIA Reflection Explainer

**Authors:**

- Alice Boxhall, Google, aboxhall@google.com
- Dominic Mazzoni, Google, dmazzoni@google.com
- Meredith Lane, Google, meredithl@google.com
- Chris Hall, Google, chrishall@google.com

## Introduction

Forked from the [Accessibility Object Model explainer](explainer.md).

This document describes the proposed web standard for reflecting ARIA attributes,
meaning that web authors can get and set ARIA attributes on DOM elements directly
via JavaScript APIs, rather than by using setAttribute and getAttribute.

As a simple example, instead of writing this code:
```js
el.setAttribute("role", "button");
el.setAttribute("aria-pressed", "true");
```

you could write this more natural code instead:
```js
el.role = "button";
el.ariaPressed = "true";
```

Even more important, instead of needing to use an IDREF in order to
express a relationship between two elements:
```js
el.setAttribute("aria-labelledby", "label-id");
```

you could instead directly reference an element.
```js
el.ariaLabelledByElement = labelEl;
```

## Motivating use cases

The motivating use cases all revolve around the challenge in setting [relationship properties](https://www.w3.org/TR/wai-aria-1.1/#attrs_relationships) without needing to use IDREFs
   - Currently, to specify any ARIA relationship,
     an author must specify a unique ID on any element which may be the target
     of the relationship.
   - In the case of something like
     [`aria-activedescendant`](https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant),
     this may be one of hundreds or thousands of elements,
     depending on the UI.
     This requirement makes these APIs cumbersome to use
     and lead to many extra DOM attributes being necessary.
     It can be difficult to ensure that programmatically-generated IDs are globally unique.
   - If the target of the IDREF is in a different tree scope, establishing a
     relationship is impossible. That prevents relationships like
     [`aria-activedescendant`](https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant),
     and
     [`aria-labelledby`](https://www.w3.org/TR/wai-aria-1.1/#aria-labelledby)
     from being used across Shadow DOM boundaries.

### Reflecting simple ARIA attributes

For the role attribute and all other ARIA attributes where the type is a boolean,
enum, number, or string, we will
[reflect](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflect)
these ARIA attributes on HTML elements, e.g.:

```js
el.role = "button";
el.ariaPressed = "true";
el.ariaDisabled = "false";
```

The reflection is bidirectional:
```js
el.setAttribute("aria-atomic", "true");
assert el.ariaAtomic == "true";
```

#### Spec/implementation status

This is now a part of the [ARIA 1.2 spec](https://www.w3.org/TR/wai-aria-1.2/#idl-interface).

This is shipping in Safari, Chrome, and Edge and it's implemented behind a flag
(`accessibility.ARIAReflection.enabled`) in Firefox.

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

#### Example: Setting relationship properties without needing to use IDREFs

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
