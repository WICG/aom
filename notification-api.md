# Accessibility (ARIA) Notification API

Authors: 
* [Daniel Libby](https://github.com/dlibby-), Microsoft
* [Sara Tang](https://github.com/sartang), Microsoft
* [Travis Leithead](https://github.com/travisleithead), Microsoft


## Abstract

For limited-vision or non-sighted users, identifying dynamic changes (non-user-initiated) in the content
of a web app is very challenging. ARIA live regions are the only mechanism available
today that communicate content changes down to the accessibility layer so that users
can hear about them. ARIA live regions are stretched far beyond their original use
cases as authors struggle to use them in scenarios that they weren't designed for.
We propose a notification API purpose-built to communicate to the accessibility layer 
for scenarios in which ARIA live regions are a poor choice.
   
## Introduction

Screen readers provide an audible presentation of web content for various kinds
of users with disabilities (e.g., those with limited or no vision). The screen
reader knows what to say based on the semantic structure of a document. Screen
readers move through the content much the same way a sighted user might scan
through the document with their eyes. When something about the document changes
(above the fold), sighted users are quick to notice and process the change. When
something below the fold (offscreen) changes, sighted users have no way of knowing
that there was a change nor how important a change it might be. This latter case is the 
conundrum for non-sighted users in general: how and when should changes in the
content be brought to their attention?

Screen readers and content authors work together to try and solve this problem. 
One way screen readers are informed about what might be an important change is
by the content author's use of ARIA live regions. A live region is an element (and
its children) that is expected to change dynamically, and for which the changes
should be announced to the user. The live region can be configured with two 
different assertiveness settings: `polite` and `assertive`.

Unfortunately, live regions are essentially _the only way_ for content authors
to express changes in the document to assistive technology. Given the lack of
other solutions, content authors use live regions in some unusual ways that far
exceed the use-cases for which they were envisioned. Today's usage patterns and 
pre-existing issues with the feature make it a challenge to use effectively:

* Screen reader output varies greatly depending on the complexity of the live
  region's content. Content authors that want a consistent experience in different
  screen readers often strip-out all the richness (and semantics) of the HTML 
  content in the live region, leaving only simple text content in hopes of
  getting a more uniform experience.

* Multiple live regions in use at a time introduce timing and precedence concerns
  for which content authors have limited control (e.g., `polite` and `assertive`
  set basic expectations around precedence of announcements, but offer little
  in the way of expressing timing (apart from the moment the change is made), or 
  other controlling factors like interruptability.

* Live regions are built around the assumption that a _visual_ change needs to be
  announced, hence they are tightly coupled with DOM nodes. Many changes important
  to announce are not necessarily tied to a visual action. In these cases, "live 
  region hacks" are employed using offscreen DOM nodes to host the live region. In
  these cases there is no surrounding context (an important consideration for many
  screen readers), nor any presentation to show. Worse yet, since these "live region
  hacks" do not play a role in the normal presentation flow of the content, they 
  are usually ommitted for performance reasons until it is determined that a 
  particular user needs an "accessible version" of the site (or by heuristically 
  trying to detect this--which is not a recommended practice). Accessibility should
  be designed into the experience from the start, and not bolted-on as an extra or
  add-on feature.

* Live-region only offer two verbosity extremes that may not strike the right 
  balance desired by content authors. `polite` may not be assertive enough (e.g., 
  in some screen readers is canceled/overridden by other basic operations like focus
  changes) and `assertive` may be too aggressive (e.g., interrupts or delays other
  relevant context changes).

## Goals

* Find a solution that can expand the capabilities presently offered by live-regions
  to offer additional desired behavior.
* Look into the scenarios where "live region hacks" are being used and understand the
  use cases and tailor an experience for those use cases. Replace the usage of "live 
  region hacks" on the web with a more appropriate solution.

## Non-Goals

* We do not want to replace live-regions with an alternate technology. Live regions work
  for a set of typical use cases and fulfill those cases when content authors use them 
  appropriately.
  
## Use Cases

The following use cases represent current "live region hacks" where live regions are
stretched beyond their intended usage. These usage patterns are better served by a new
solution that compliments live regions.

### Keyboard action confirmation

Keyboard commands not associated with UI often do not have an affordance for confirming
their state. The following cases are variations on this theme:

1. **Glow text command:** User is editing text, highlights a word and presses 
    `Shift`+`Alt`+`Y` which makes it glow blue. No UI elements were triggered or changed
    state, but the user should hear some confirmation that the action was successful, 
    such as "selected text is now glowing blue."

2. **Set Presence**. In a chat application, the user presses `Shift`+`Alt`+`4` to toggle
    their *presence* state to `do not disturb`. The application responds with "presence set
    to do not disturb." 

   2.1. **Most recent notification priority:** the user presses `Shift`+`Alt`+`3` by mistake,
         and then quickly presses `Shift`+`Alt`+`4`. The application began to respond with
         "presence..." [set to busy] but interrupts itself with the latest response "presence
         set to do not disturb."

   2.2. **Overall priority.** The user presses `Shift`+`Alt`+`4`, then immediately issues an
         AT command to jump to the next header. The response "presence set to do not disturb"
         is not announced because the focus change to the next header and subsequent contextual
         read-out preempted it.

### Failed or delayed actions

According to common screen reader etiquette, user actions are assumed to be successful by
virtue of issuing the command to do the action itself (no specific confirmation of the action
needed); however, if the action fails or is delayed, the user should then be notified. In these
unexpected cases users should be notified, otherwise their understanding about the state of the
app will be off.

3. **Longer than usual.** User completes typing a mail message, presses _send_. In the normal
    flow, no confirmation of "sent" is needed because this is assumed by the action, and focus
    is redirected to the message list or next message. However, due to some networking conditions,
    the _send_ action is taking longer than usual. The user should hear "message is taking longer
    than usual to send".

    3.1. **High overall priority.** After pressing _send_, the user resumes navigating through
          the message list. At the conclusion of reading an existing email subject line, the AT
          breaks in with "message is taking longer than usual to send". (Note, there should be
          some means of separating this announcement from the prior email text, lest it be
          considered a part of the email subject line).

4. **Fail to paste.** User thought they had copied some text onto the clipboard, but in the
    context of editing when they issue the paste keyboard shortcut, nothing is in the clipboard
    and nothing pastes into the app. In this case, it is appropriate for the app to note the
    failed action: "failed to paste, clipboard empty". 

### Secondary actions

In addition to a primary (implicit) action, some actions have secondary or follow-up effects 
that should be announced beyond the immediate effect of the primary action.

5. **Auto fill.** In a spreadsheet, an action that sets a cell's value may be assumed to happen
    (no announcement) or could be announced as a side-effect of changing the cell's value (e.g., 
    using a live region). In either case this would be the normal expectation for the user. However,
    as a result of setting the value, the spreadsheet triggered a secondary action of autofilling a
    range of corresponding values in the cell's column. This is an opportunity for the app to 
    additionally announce "autofilled values in cells A2 through A20".

## Proposed Solution

A new API enables posting textual descriptions (strings) as imperative notifications to the
browser's accessibility layer. The API `ariaNotify` is available on both the Document and on 
every Element.

```js
// Queue a message to the notification queue associated with the document:
document.ariaNotify( "New collaborator X is now connected." );
// Queue a message to the notification queue associated with an element:
document.querySelector("#richEditRegion1").ariaNotify( "Selected text is now glowing blue." );
```

A screen reader or other assistive technology tool would pick from among these queues to speak
or show "new collaborator X is now connected" and "selected text is now glowing blue" in some
implementation-dependant manner. (This proposal does not attempt to define the mutli-queue total 
order for all notifications (which may be interleaved with ARIA live region announcements or other
announcements from user-actions).

For users without assistive technology tools running, nothing would happen. The call to the API
has no web-observable side effects and its use should not infer that the user is using assistive 
technology. 

For a single notification queue source, multiple calls to its notification API will append 
notifications into its queue one after another.

```js
// Use the document's queue.
document.ariaNotify( "Paste failed." );
document.ariaNotify( "Text copied to clipboard." );
```

In this example, the author is guaranteed that the notification "paste failed" will be announced
*before* the notification "text copied to clipboard". However, there is no guarantee that other 
announcements from other notification queues won't happen before, between, or after either of these
two notifications.

For a single notification queue source (like the one on *document* shown previously), several options
are available to manage how notifications behave in the queue and how they may interact with other
notifications being serviced:

* `placeInQueue` - indicates which end of the notification queue the new notification should be inserted 
    into: at the `back` (traditional queuing behavior, similar to ARIA live region's "polite" value);
    at the `front` (traditional stacking behavior. This notification will be serviced next, similar to
    ARIA live region's "assertive" value), or `update` (clear this notification queue of any previous
    notifications and then add this notification).
    * The **default value** is `back`.
* `interruptCurrent` - If an existing notification is being read, is this notification so time-sensitive
    that it should interterrupt what is currently being read? Takes a `true` or `false` value.
    * The **default value** is `false`.

The following example puts four notifications in the body element's notification queue, using the
`placeInQueue: "update"` which "updates" the queue each time so that only the most recent notification
is kept in the queue. As each notification enters the queue it will not attempt to interrupt any 
existing notification being read/shown to the user:

```js
let ariaNotificationOptions = {
  placeInQueue: "update", // other values "front" & "back" (default value)
  interruptCurrent: false // false is the default value, specified for illustrative purposes
};
// (Each of these triggered by rapid keyboard shortcut usage, of course)
document.body.ariaNotify( "Text bolded", ariaNotificationOptions );
document.body.ariaNotify( "Text unbolded", ariaNotificationOptions );
document.body.ariaNotify( "Text bolded", ariaNotificationOptions );
document.body.ariaNotify( "Text unbolded", ariaNotificationOptions );
```

## Open Issues

### 1. Spamming mitigations

The general nature of a notification API means that authors could use it for scenarios 
that are already handled by the AT (such as for focus-change actions) resulting in
confusing double-announcements (in the worst case) or extra unwanted verbosity (in
the best case).

Note: ATs tune their behavior for the best customer experiences. AT-provided 
verbosity settings matching user preferences could conflict with author expectations
leading to poor experiences.

Authors may also apply the use of this API too liberally, confirming many trivial
user actions where typical expectations do not require any notification.

Finally, malicious attackers can use the API as a Denial-of-Service against AT users.

To mitigate against these approaches we can consider several options:
* making use of [User Activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation)
   primitives to limit usage of this API to only actions taken by the author
* global notification queue limits. Apply a maximum threshold to the combined queues 
   so that queue growth is not unbounded.
* time-gated use. Add a "cool down" timer between calls to the API so that notifications
   cannot be added to the queue in a tight loop. (This option may not be desirable as some
   scenarios may require frequent (but not sustained) queue management.

### 2. Cross-origin iframe access

Should `ariaNotify` be allowed from cross-origin iframes? We would like to avoid potential
3rd party abuse.

### 3. Express clearing of the queue

Some scenarios may add many notifications into the queue, but then have an event happen
that renders all the previously-queued notifications irrelevant. This scenario could happen
both for notifications queued using `front`/`back` and also for `update`.

The API as it stands currently provides no way to clear the queue without adding a new
notification into the queue at the same time (see `update`). One option is to add a new
`ariaClearNotifications()` API. Another workaround might be an `update` message with an 
empty string (if such empty string messages are not dropped as an implementation 
optimization).

### 4. Non-interruptable messages

The API provides `interruptCurrent` as a way of expressing that the new notification may 
interrupt (or not) any existing notification that is being spoken/displayed.

In the scenario that some notification is generated which needs to be received in full
(and not cut short because of a focus-change announcement or other state change), an option 
to set `interruptable` for the current message to provide a boolean hint to ATs that the
message should not be interrupted except by express "mute" action by the user.

## FAQ

### 1. Is this API going to lead to privacy concerns for AT users?

No. This API has been designed to be "write-only" meaning that its use shoudl have no other
apparent observable side-effects that could be used for fingerprinting.

See Security and Privacy section for additional details.

### 2. Are Element-level notifications really necessary?

Adding `ariaNotify` to Elements was driven by several goals:

* Resolve the question of how *language* input should be provided. To keep the API
   simple, we are able to leverage the `lang` attribute that is used to override
   the document language for specific subtrees. `ariaNotify` can use the nearest
   ancestor element's `lang` attribute as a language hint (or the document's 
   default language).
* Provide a simpler model for handling multiple queues. Being able to enqueue 
   notifications into separately-managed queues is an important scenario and would
   require explicit queue management if only a singleton `ariaNotify` existed on the
   document. By giving each node (elements + document) their own queue, the API can
   stay simple while enabling specific queue managment options.
* ATs such as screen readers can filter/prioritize notifications based on the 
   element associated with the notification queue. E.g., the element's current
   visibility in the User Agent, the element's proximity to the focused element.
   (Same potential options available with ARIA live regions today.)

### 3. Is the notification limited to plaintext strings as input?

For example, should the API allow for richer formatted text? Formatting could provide hints 
for expressiveness and pronounciation (TTML and WebVTT are potential candidates).
While we think Element-level context will help with some of the desired context, 
we aren't pursing a richer text format at this time.

### 4. Will "Earcons" or other notification filtering options be available?

"Earcons" are short audio cues used to convey contextual information in the way that
icons provide meaning for sighted users. "Earcons" might provide a set of known,
standardized (enum) values that can be associated with notification audio cues and
may also provide notification filtering options for users.

For example, a generic set of "earcons" might map to the following scenarios and
values:
* recent action completion status: `success` / `warning` / `failure`
* async/indeterminate task progress: `started` / `in-progress` / `blocked` / `canceled`
* navigational boundary endpoints: `beginning` / `middle` / `end`
* value-relative state changes: `increase` / `decrease`
* user interface state: 
   * `clickable` / `clicked`
   * `enabled` / `disabled`
   * `editable` / `readonly`
   * `selected` / `unselected`

Providing earcons (through this API or something similar) is a request we are
considering for future work.

### 5. Can this API allow for output verbosity preferences?

Screen reader users can customize the verbosity of the information (and context) that
is read to them via settings. This API does not offer a way to provide alternative strings
for different levels of verbosity (or flags to mark the expected verbosity of the 
notifications that get queued). 

ATs may derive their own methods of shortening notifications sent via `ariaNotify`, but
these design decisions are beyond the scope of this proposal. 

## Privacy and Security Considerations

1. **Timing.** The use of the API provides no return value, but parameters must still
    be processed. Implementations should take care to avoid optimizing-out the synchronous
    aspects of processing this API, as predictable timing differences from when the 
    API is "working" (an AT is connected) vs. "not working" (no AT connnected) could 
    still be used to infer the presence of a user with an AT active.
3. **Readback.** Any readback of configuration settings for an AT via an API have the
    potential of exposing a connected (vs. not connected) AT, and as such is an easy
    target for fingerprinting AT users, an undesireable outcome. Similarly, confirmation
    of notifications (such as via a fulfilled promise) have similar traits and are
    avoided in this proposal.
2. **Authoritative-sounding notifications.** Announcements could be crafted to deceive
    the user into thinking they are navigating trusted UI in the browser by arbitrarily 
    reading out control areas/names that match a particular target browser’s trusted UI.
    *  Mitigations should be applied to suppress notifications when focus moves outside 
        of the web content.
    *  Additional mitigations to block certain trusted phrases related to the browser's
        trusted UI could be considered.
3. **Secure Context**. Does it make sense to offer this feature only to Secure Contexts?
    Should usage of this API be automatically granted to 3rd party browsing contexts?
4. **Data Limits** (See [Security and Privacy Questionnaire #2.7](https://www.w3.org/TR/security-privacy-questionnaire/#send-to-platform))
    Should there be a practical limit on the amount of text that can be sent in one call 
    to the API? Just like multiple-call DoS attacks, one call with an enormous amount of
    text could tie up an AT or cause a hang as data is marshalled across boundaries.
    
## Alternative Solutions

The design of this API is loosely inspired by the [UIA Notification API](https://docs.microsoft.com/en-us/windows/win32/api/uiautomationcoreapi/nf-uiautomationcoreapi-uiaraisenotificationevent)).

Previous discussions for a Notifications API in the AOM and ARIA groups:
* [Issue 3 - Use Case: Accessibility Notifications](https://github.com/wicg/aom/issues/3)
* [Issue 84 - Live region properties vs announcement notification](https://github.com/WICG/aom/issues/84)
* [Issue 832 - Do we need a notifications API in ARIA](https://github.com/w3c/aria/issues/832)


