import { RocketChatDesktopAPI } from './servers/preload/api';

declare global {
  interface Window {
    RocketChatDesktop: RocketChatDesktopAPI;
  }
}

console.log('[Rocket.Chat Desktop] Injected.ts');

const start = (): void => {
  console.log('[Rocket.Chat Desktop] Injected.ts start fired');
  if (typeof window.require !== 'function') {
    console.log('[Rocket.Chat Desktop] window.require is not defined');
    console.log('[Rocket.Chat Desktop] Inject start - retrying in 1 seconds');
    setTimeout(start, 1000);
    return;
  }

  const { Info: serverInfo = {} } =
    window.require('/app/utils/rocketchat.info') ?? {};

  if (!serverInfo.version) {
    console.log('[Rocket.Chat Desktop] serverInfo.version is not defined');
    return;
  }

  console.log('[Rocket.Chat Desktop] Injected.ts serverInfo', serverInfo);

  window.RocketChatDesktop.setServerInfo(serverInfo);

  const { Meteor } = window.require('meteor/meteor');
  const { Session } = window.require('meteor/session');
  const { Tracker } = window.require('meteor/tracker');
  const { UserPresence } = window.require('meteor/konecty:user-presence');
  const { settings } = window.require('/app/settings');
  const { getUserPreference } = window.require('/app/utils');

  window.RocketChatDesktop.setUrlResolver(Meteor.absoluteUrl);

  Tracker.autorun(() => {
    const unread = Session.get('unread');
    window.RocketChatDesktop.setBadge(unread);
  });

  Tracker.autorun(() => {
    const { url, defaultUrl } = settings.get('Assets_favicon') || {};
    window.RocketChatDesktop.setFavicon(url || defaultUrl);
  });

  const open = window.open.bind(window);

  Tracker.autorun(() => {
    const jitsiDomain = settings.get('Jitsi_Domain') || '';

    console.log(
      '[Rocket.Chat Desktop] window.open for Jitsi overloaded',
      jitsiDomain
    );
    window.open = (url, name, features = '') => {
      if (
        typeof url === 'string' &&
        url.includes(jitsiDomain) &&
        !process.mas &&
        window.RocketChatDesktop.getInternalVideoChatWindowEnabled()
      ) {
        return open(url, 'Jitsi Meet', `scrollbars=true,${features}`);
      }

      return open(url, name, features);
    };
  });

  Tracker.autorun(() => {
    const { url, defaultUrl } = settings.get('Assets_background') || {};
    window.RocketChatDesktop.setBackground(url || defaultUrl);
  });

  Tracker.autorun(() => {
    const siteName = settings.get('Site_Name');
    window.RocketChatDesktop.setTitle(siteName);
  });

  Tracker.autorun(() => {
    const uid = Meteor.userId();
    const isAutoAwayEnabled: unknown = getUserPreference(uid, 'enableAutoAway');
    const idleThreshold: unknown = getUserPreference(uid, 'idleTimeLimit');

    if (isAutoAwayEnabled) {
      delete UserPresence.awayTime;
      UserPresence.start();
    }

    window.RocketChatDesktop.setUserPresenceDetection({
      isAutoAwayEnabled: Boolean(isAutoAwayEnabled),
      idleThreshold: idleThreshold ? Number(idleThreshold) : null,
      setUserOnline: (online) => {
        if (!online) {
          Meteor.call('UserPresence:away');
          return;
        }
        Meteor.call('UserPresence:online');
      },
    });
  });

  const destroyPromiseSymbol = Symbol('destroyPromise');

  console.log('[Rocket.Chat Desktop] Injected.ts replaced Notification');

  window.Notification = class RocketChatDesktopNotification
    extends EventTarget
    implements Notification
  {
    static readonly permission: NotificationPermission = 'granted';

    static readonly maxActions: number =
      process.platform === 'darwin' ? Number.MAX_SAFE_INTEGER : 0;

    static requestPermission(): Promise<NotificationPermission> {
      return Promise.resolve(RocketChatDesktopNotification.permission);
    }

    [destroyPromiseSymbol]?: Promise<() => void>;

    constructor(
      title: string,
      options: NotificationOptions & { canReply?: boolean } = {}
    ) {
      super();

      for (const eventType of ['show', 'close', 'click', 'reply', 'action']) {
        const propertyName = `on${eventType}`;
        const propertySymbol = Symbol(propertyName);

        Object.defineProperty(this, propertyName, {
          get: () => this[propertySymbol],
          set: (value) => {
            if (this[propertySymbol]) {
              this.removeEventListener(eventType, this[propertySymbol]);
            }

            this[propertySymbol] = value;

            if (this[propertySymbol]) {
              this.addEventListener(eventType, this[propertySymbol]);
            }
          },
        });
      }

      this[destroyPromiseSymbol] = window.RocketChatDesktop.createNotification({
        title,
        ...options,
        onEvent: this.handleEvent,
      }).then((id) => () => {
        window.RocketChatDesktop.destroyNotification(id);
      });

      Object.assign(this, { title, ...options });
    }

    actions: readonly NotificationAction[] = [];

    badge = '';

    body = '';

    data: any = undefined;

    dir: NotificationDirection = 'auto';

    icon = '';

    image = '';

    lang = document.documentElement.lang;

    onclick: ((this: Notification, ev: Event) => any) | null = null;

    onclose: ((this: Notification, ev: Event) => any) | null = null;

    onerror: ((this: Notification, ev: Event) => any) | null = null;

    onshow: ((this: Notification, ev: Event) => any) | null = null;

    renotify = false;

    requireInteraction = false;

    silent = false;

    tag = '';

    timestamp: number = Date.now();

    title = '';

    vibrate: readonly number[] = [];

    private handleEvent = ({
      type,
      detail,
    }: {
      type: string;
      detail: unknown;
    }): void => {
      const mainWorldEvent = new CustomEvent(type, { detail });

      const isReplyEvent = (
        type: string,
        detail: unknown
      ): detail is { reply: string } =>
        type === 'reply' &&
        typeof detail === 'object' &&
        detail !== null &&
        'reply' in detail &&
        typeof (detail as { reply: string }).reply === 'string';

      if (isReplyEvent(type, detail)) {
        (mainWorldEvent as any).response = detail.reply;
      }
      this.dispatchEvent(mainWorldEvent);
    };

    close(): void {
      if (!this[destroyPromiseSymbol]) {
        return;
      }

      this[destroyPromiseSymbol]?.then((destroy) => {
        delete this[destroyPromiseSymbol];
        destroy();
      });
    }
  };
};

console.log('[Rocket.Chat Desktop] Injected');

const injectDarkMode = () => {
    var newStyle = document.createElement("style");
        newStyle.innerHTML = `/******************************************
        *************General Settings*************
        ******************************************/
  
        :root {
            --primary-font-color: #444;
            --info-font-color: #a0a0a0;
            --color-darker: #272c33;
        }
  
        /* Reset global font color so that it's changable more easily */
        .color-primary-font-color, textarea {
            color: var(--primary-font-color);
        }
  
        .color-info-font-color {
            color: var(--info-font-color);
        }
  
        input, select, textarea {
            color: var(--input-text-color);
        }
  
        .error-color {
            color: var(--rc-color-error);
        }
  
        .js-button[aria-label="Toggle Dark Mode"] {
            transition: filter 150ms;
        }
  
        .rcx-icon--name-darkmode {
            height: 1em;
            font-size: 1rem !important;
        }
  
        @media (min-width: 1372px) {
            .sidebar__toolbar-button {
                margin: 0 3px;
            }
        }
  
        @keyframes highlight {
            from {
                background-color: hsl(216, 92%, 54%);
            }
        }
  
        /******************************************
         ************Transition Effect*************
        ******************************************/
        input,
        textarea,
        select,
        .color-primary-font-color,
        .color-info-font-color,
        .background-info-font-color,
        .background-transparent-darker-before::before,
        .messages-box .message .body, /* override for opacity transition */
        .rc-header__name,
        .rc-header__wrap,
        .message .reactions>li,
        .message .title .is-bot,
        .message .title .role-tag,
        .message.new-day::before,
        .code-colors,
        .hljs-selector-id,
        .hljs-selector-tag,
        .hljs-attribute,
        .hljs-keyword,
        .hljs-title,
        .hljs-doctag,
        .hljs-string,
        .hljs-type,
        .hljs-literal,
        .hljs-number,
        .hljs-tag,
        .hljs-name,
        .hljs-attr,
        .hljs-template-variable,
        .hljs-variable,
        .rc-message-box__container,
        .messages-container .footer,
        .content-background-color,
        .message.new-day::after,
        .message .reactions>li,
        .border-component-color,
        .contextual-bar__header,
        .contextual-bar__content,
        .sidebar__footer {
            transition: opacity 300ms linear, color 150ms, background-color 150ms, border-color 150ms;
        }
  
        /******************************************
         *************Dark Mode Settings***********
        ******************************************/
        body.dark-mode {
  
            /****************************** Custom Variables ******************************/
            --primary-font-color: var(--color-gray-lightest);
            --info-font-color: var(--color-gray-light);
            --message-box-background: hsla(0, 0, 100%, 0.1);
  
            --button-outline-color: var(--color-gray-medium);
            --button-close-color: var(--color-gray-medium);
  
  
            /********************** Overridden Rocket.Chat Variables **********************/
  
            /* General Colors */
            --rc-color-alert-message-warning-background: hsl(352, 83%, 20%);
            --rc-color-primary: var(--color-gray-lightest);
            --rc-color-primary-lightest: var(--color-dark-medium);
  
            /* Forms - Button */
            --button-disabled-background: var(--color-dark-70);
            --button-disabled-text-color: var(--color-dark-80);
  
            /* Forms - Input */
            --input-text-color: var(--color-gray-lightest);
            --input-icon-color: var(--color-gray-lightest);
  
            /* Forms - popup list */
            --popup-list-background: var(--color-dark);
            --popup-list-background-hover: var(--color-darkest);
            --popup-list-selected-background: var(--color-dark);
            --popup-list-name-color: var(--color-white);
  
            /* Forms - tags */
            --tags-text-color: var(--color-white);
            --tags-background: var(--color-blue);
  
            /* Sidebar */
            --sidebar-background: var(--color-dark);
            --sidebar-background-hover: var(--color-darkest);
  
            /* Chip */
            --chip-background: var(--color-blue);
  
            /* Mention link */
            --mention-link-background: var(--color-dark-medium);
            --mention-link-text-color: var(--color-light-blue);
            --mention-link-me-background: var(--alerts-background);
            --mention-link-me-text-color: var(--color-white);
            --mention-link-group-background: var(--alerts-background);
            --mention-link-group-text-color: var(--color-white);
  
            /* Message box */
            --message-box-user-activity-color: var(--color-gray-lightest);
            --message-box-user-activity-user-color: var(--color-gray-lightest);
  
            /* Header */
            --header-title-username-color-darker: var(--color-gray-lightest);
            --header-background-color: var(--color-darkest);
  
            /* Popover */
            --popover-background: var(--color-dark);
            --popover-background-hover: var(--color-dark-medium);
            --popover-title-color: var(--color-white);
            --popover-item-color: var(--color-white);
  
            /* Tooltip */
            --tooltip-background: var(--color-darkest);
            --tooltip-text-color: var(--color-white);
  
            /* alert */
            --alerts-background: #1d73f5;
            --alerts-color: var(--color-white);
  
            --message-box-editing-color: var(--rc-color-alert-message-warning-background);
            --rc-color-alert: var(--color-dark-red);

            /* text */
            --rcx-color-foreground-default: var(--color-gray-lightest);
        }
  
        /******************************************
         *********Manual Dark Theme Overrides******
        ******************************************/
  
        /***************Main Chat*****************/
  
        /* Breadcrumbs discussions */
        body.dark-mode .rcx-room-header .rcx-tag--default {
            background-color: unset; 
        }
  
        /* Blockquote */
        body.dark-mode .rcx-css-1d5cod7 {
            background-color: var(--color-darkest) !important;
        }

        body.dark-mode .rcx-message {
            background-color: var(--color-darkest) !important;
        }
  
        body.dark-mode blockquote.rcx-attachment__details .rcx-box--full {
            color: var(--secondary-font-color);
        }
  
        body.dark-mode .rcx-css-11c35pn:hover .rcx-attachment__details,
        body.dark-mode .rcx-css-11c35pn:focus .rcx-attachment__details {
            background-color: var(--color-dark) !important;
        }
  
        /* Attachements content */
        body.dark-mode .rcx-message-attachment .rcx-attachment__content .rcx-box--full {
            color: var(--primary-font-color);
        }
  
        body.dark-mode .rcx-message-attachment .rcx-attachment__content .rcx-box--full.rcx-box--with-block-elements pre code {
            background-color: var(--color-dark);
            color: var(--primary-font-color);
        }
  
        /* Pinned messages content */
        body.dark-mode .rcx-css-ntpg4f {
            color: var(--rc-color-primary) !important;
        }
  
        /* Message "You joined a new private conversation with" */
        body.dark-mode .rcx-css-dlop43 {
            color: var(--rc-color-primary) !important;
        }
  
        body.dark-mode .main-content a {
            color: var(--color-light-blue);
        }
  
        body.dark-mode .main-content .messages-box .wrapper {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .mention-link--group {
            color: var(--mention-link-group-text-color) !important;
        }
  
        body.dark-mode .mention-link--me {
            color: var(--mention-link-me-text-color) !important;
        }
  
        body.dark-mode select {
            background-color: var(--color-dark);
        }
  
        body.dark-mode select option {
            color: var(--color-white);
        }
  
        body.dark-mode .sidebar-item > a {
            color: inherit;
        }
  
        body.dark-mode .highlight-text {
            background-color: var(--color-blue);
        }
  
        body.dark-mode .rc-switch__text {
            color: var(--color-white);
        }
  
        body.dark-mode .rc-switch-double {
            color: var(--color-white);
        }
  
        body.dark-mode .rc-switch__button {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .error-border {
            border-color: var(--color-dark-red);
        }
  
        body.dark-mode .background-component-color {
            background-color: var(--color-dark-blue);
        }
  
        body.dark-mode .upload-progress-progress {
            background-color: var(--color-blue);
        }
  
        body.dark-mode .container-bars .color-primary-action-color {
            color: var(--color-white);
        }
  
        body.dark-mode .burger i {
            background-color: var(--color-white);
        }
  
        body.dark-mode .rc-member-list__user.active,
        body.dark-mode .rc-member-list__user:hover {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .rc-user-info-details {
            background-color: var(--color-dark-medium);
        }
  
        body.dark-mode p.rc-user-info-details__info {
            color: var(--color-white);
        }
  
        body.dark-mode .messages-container .footer,
        body.dark-mode .content-background-color {
            background-color: var(--header-background-color);
        }
  
        body.dark-mode .message {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .message.new-day::after,
        body.dark-mode .message .reactions>li,
        body.dark-mode .border-component-color {
            border-color: var(--rc-color-primary-lightest);
        }
  
        body.dark-mode .message .reactions>li,
        body.dark-mode .message .title .is-bot,
        body.dark-mode .message .title .role-tag,
        body.dark-mode .message.new-day::before {
            background-color: var(--rc-color-primary-dark);
        }
  
        body.dark-mode .message.active,
        body.dark-mode .message:hover {
            background-color: var(--color-darker);
        }
  
        body.dark-mode .message.editing {
            background-color: var(--color-dark-blue);
        }
  
        body.dark-mode .message.first-unread .body:after {
            background-color: var(--header-background-color);
        }
  
        body.dark-mode .rc-message-box__container {
            background-color: var(--message-box-background);
        }
  
        body.dark-mode .rc-old .rc-message-box .reply-preview {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .message-actions,
        body.dark-mode .rc-member-list__counter {
            color: var(--color-gray-light);
            background-color: var(--color-darkest);
            border-color: var(--color-dark);
        }
  
        body.dark-mode .message-actions__button:hover,
        body.dark-mode .message-actions__menu:hover {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .message .body > table thead tr {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .message .body > table tr {
            background-color: var(--color-dark-medium);
        }
  
        body.dark-mode .message .body > table tr:nth-child(2n) {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .background-transparent-darker-before::before {
            background-color: var(--color-dark-medium);
        }
  
        /* User card */
        body.dark-mode .rcx-user-card {
            background-color: var(--color-dark) !important;
        }
  
        body.dark-mode .rcx-user-card .rcx-button:not(.rcx-css-ue04py) {
            background-color: var(--color-dark-medium);
            border: none;
        }
  
        body.dark-mode .rcx-user-card .rcx-button:hover {
            background-color: var(--color-dark-light);
            border: none;
        }
  
        /* Modals */
  
        body.dark-mode .rcx-modal__header .rcx-button--ghost.rcx-button:hover {
            color: var(--rc-color-primary-lightest);
        }
  
        /* Temporary fix for modals where "Cancel" button is missing 'rcx-button--ghost' class */
        body.dark-mode .rcx-modal__footer .rcx-box.rcx-box--full.rcx-box--animated.rcx-button.rcx-button-group__item:first-of-type:not(.rcx-button--ghost) {
            color: var(--rc-color-primary-lightest);
        }
  
        /*body.dark-mode .background-info-font-color {
            background-color: var(--color-dark-medium);
        }*/
  
        body.dark-mode .rcx-modal__inner,
        body.dark-mode .rcx-modal__footer {
            background: var(--color-dark);
        }
  
        body.dark-mode .rc-modal__footer,
        body.dark-mode .rc-modal {
            background: var(--color-darkest);
        }
  
        body.dark-mode .rc-modal__content,
        body.dark-mode .rc-modal__header,
        body.dark-mode .rcx-modal__content,
        body.dark-mode .rcx-modal__inner,
        body.dark-mode .rcx-modal__header,
        body.dark-mode .rcx-modal__title {
            color: var(--color-white);
        }
  
        body.dark-mode .rc-button--outline {
            border-color: var(--button-outline-color);
            color: var(--button-outline-color);
        }
  
        body.dark-mode .rc-button--outline.js-close,
        body.dark-mode .rc-button--nude.js-close {
            border-color: var(--button-close-color);
            color: var(--button-close-color);
        }
  
        body.dark-mode .rc-button--cancel,
        body.dark-mode .rc-button--danger {
            background-color: var(--button-cancel-color);
            border-color: var(--button-cancel-color);
            color: var(--button-primary-text-color);
        }
  
        body.dark-mode .contextual-bar {
            background-color: var(--color-dark);
            border-left: 2px solid var(--color-dark-medium);
        }
  
        body.dark-mode .contextual-bar__header {
            background-color: var(--color-dark);
            border-bottom: 1px solid var(--color-dark-medium);
        }
  
        body.dark-mode .contextual-bar__content {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rc-member-list__counter {
            background-color: var(--color-dark);
        }
  
        /**** Select / Dropdowns ****/
  
        body.dark-mode .rcx-select {
            background-color: var(--rc-color-primary-darkest) !important;
        }
  
        body.dark-mode .rcx-options > .rcx-tile {
            background-color: var(--rc-color-primary-darkest) !important;
        }
  
        body.dark-mode .rcx-options .rcx-option,
        body.dark-mode .rcx-options .rcx-option--focus /* Temporary fix while focus is not refreshed */ {
            background-color: var(--rc-color-primary-darkest) !important;
            color: var(--color-white) !important;
        }
  
        body.dark-mode .rc-popover__content .rcx-option:hover,
        /* body.dark-mode .rcx-options .rcx-option--focus, */ /* Temporary fix while focus is not refreshed */
        body.dark-mode .rcx-options .rcx-option--selected {
            background-color: var(--color-dark-light) !important;
        }
  
        body.dark-mode .rcx-options .rcx-option:hover,
        body.dark-mode .rcx-options .rcx-option--selected:hover {
            background-color: var(--color-dark) !important;
        }
  
        /***** Buttons *****/
  
        /* Regular button style */
        body.dark-mode .main-content .rcx-button:not(.rcx-button--ghost) { /* Default */
            background-color: var(--color-dark) !important;
        }
        body.dark-mode .main-content .rcx-button:is(.rcx-button--ghost, .rcx-button):hover { /* Hovered or selected */
            background-color: var(--color-darkest) !important;
        }
  
        /* Square (icon) button style */
        body.dark-mode .main-content .rcx-button--square:not(.rcx-button--ghost), /* Default */
        body.dark-mode .main-content .rcx-button--square:is(.rcx-button--ghost, .rcx-button):hover {  /* Hovered or selected */
            background-color: var(--color-darkest) !important;
            border-color: transparent !important;
        }
  
        body.dark-mode .main-content .rcx-button--square:is(.rcx-button--ghost, .rcx-button):focus {
            background-color: var(--color-darkest);
            border-color: transparent !important;
            box-shadow: 0 0 0 .1rem var(--color-gray);
        }
  
        /* Menu buttons on top right (threads, search, etc.) */
        body.dark-mode .rcx-css-15vvv6z:hover,
        body.dark-mode .rcx-css-ue04py:hover,
        body.dark-mode .rcx-css-15vvv6z:active,
        body.dark-mode .rcx-css-ue04py:active {
            border-color: var(--color-dark-medium) !important;
            background-color: var(--color-dark-medium) !important;
        }
  
        body.dark-mode .rcx-css-136xdpx {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .rcx-button {
            color: var(--info-font-color);
        }
  
        body.dark-mode .rcx-button--ghost:not(.rcx-button--square):hover {
            color: var(--color-dark) !important;
        }
  
        body.dark-mode .rcx-button--primary {
            color: var(--info-font-color);
            background-color: #095ad2
        }
  
        body.dark-mode .rcx-button--primary:disabled {
            color: var(--color-gray);
        }
  
        body.dark-mode .rcx-button--danger {
            color: var(--rcx-button-colors-secondary-danger-color,var(--rcx-color-danger-500,#f5455c));
        }
  
        /***** Left sidebar *****/
  
        body.dark-mode .rcx-box.rcx-box--full.rcx-tile--elevation-2.rcx-tile {
            background-color: var(--color-dark-medium);
            color: var(--primary-font-color);
        }
  
        body.dark-mode .rcx-box.rcx-box--full.rcx-tile--elevation-2.rcx-tile .rcx-option__title,
        body.dark-mode .rcx-box.rcx-box--full.rcx-tile--elevation-2.rcx-tile .rcx-option {
            color: var(--primary-font-color);
        }
  
        body.dark-mode .rcx-box.rcx-box--full.rcx-tile--elevation-2.rcx-tile .rcx-option:hover {
            background-color: var(--color-dark-light);
        }
  
        /***** Right sidebar *****/
  
        /* TODO : switch toggle */
  
        body.dark-mode .rcx-vertical-bar {
            background-color: var(--rc-color-primary-background) !important;
        }
  
        body.dark-mode .rcx-css-136xdpx:hover, /* Thread list item */
        body.dark-mode .rcx-css-136xdpx:focus, 
        body.dark-mode .rcx-css-1es44sn:hover, /* Files list item */
        body.dark-mode .rcx-css-1es44sn:focus {
            background-color: var(--rc-color-primary-dark);
        }
  
        /* Targets unread message indicator in threads panel. */
        body.dark-mode button.rcx-contextual-message__follow + div.rcx-box--full {
            background-color: #1d74f5 !important;
        }
        /***** Members list *****/
  
        body.dark-mode .rcx-option__content {
            color: var(--color-gray-light);
        }
        /***** Chat file list *****/
  
        body.dark-mode .rcx-css-18t0quo {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .rcx-css-18t0quo:hover {
            background-color: var(--color-dark-medium);
        }
  
        body.dark-mode .attachments__item:hover, .attachments__item:active {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .attachments__content:hover, .attachments__content:active {
            color: var(--primary-font-color);
        }
  
        body.dark-mode .attachments__name {
            color: var(--color-blue);
        }
  
        body.dark-mode .attachments__name:hover, .attachments__name:active {
            color: var(--color-light-blue);
        }
  
        body.dark-mode .rc-popover__item:hover {
            background-color: var(--popover-background-hover);
        }
  
        body.dark-mode .rc-popover__content {
            background-color: var(--popover-background);
            box-shadow: 0px 0px 2px var(--color-dark-20);
        }
  
        body.dark-mode .emoji-picker .filter-item.active {
            border-color: var(--color-light-blue);
        }
  
        body.dark-mode .rcx-room-header hr.rcx-divider {
            border-color: var(--color-dark-medium);
        }

        body.dark-mode .rcx-message-divider {
            border-color: var(--color-dark-medium);
            background-color: var(--color-darkest);
        }

        body.dark-mode .rcx-message-divider__wrapper{
            background-color: var(--color-dark-medium);
            color: white;
        }
  
        body.dark-mode aside.rcx-box.rcx-box--full.rcx-vertical-bar,    /* right aside (threads, search, etc.) */
        body.dark-mode .rcx-css-ccvr3m,                                 /* thread list message */
        body.dark-mode .rcx-css-1j3nsmc,                                /* thread list message */
        body.dark-mode .rcx-css-1bmadou,                                /* thread list header */
        body.dark-mode .rcx-css-1yhzjdg                                 /* thread list search bar */
        {
            border-color: var(--color-dark-medium) !important;
        }
  
        body.dark-mode .room-leader:hover {
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .chat-now {
            color: var(--color-white);
        }
  
        body.dark-mode .message-popup-title {
            background-color: var(--color-dark);
        }
  
        /**************Code Highlights*****************/
  
        body.dark-mode .code-colors,
        body.dark-mode .rc-old code.inline {
            background: var(--color-dark-100);
            color: var(--color-gray-light);
        }
  
        body.dark-mode .hljs-selector-id,
        body.dark-mode .hljs-keyword {
            color: var(--color-light-blue);
        }
  
        body.dark-mode .hljs-title {
            color: var(--color-gray-light);
        }
  
        body.dark-mode .hljs-literal,
        body.dark-mode .hljs-number,
        body.dark-mode .hljs-attr,
        body.dark-mode .hljs-template-variable,
        body.dark-mode .hljs-variable {
            color: var(--color-dark-green);
        }
  
        body.dark-mode .hljs-tag,
        body.dark-mode .hljs-name {
            color: var(--color-light-blue);
        }
  
        body.dark-mode .hljs-selector-tag,
        body.dark-mode .hljs-subst {
            color: var(--color-green);
        }
  
        body.dark-mode .hljs-doctag,
        body.dark-mode .hljs-string {
            color: var(--color-red);
        }
  
        body.dark-mode .hljs-attribute,
        body.dark-mode .hljs-type,
        body.dark-mode .hljs-number {
            color: var(--color-orange);
        }
  
        body.dark-mode .hljs-addition {
        background-color: #1e3a21;
        }
        body.dark-mode .hljs-deletion {
        background-color: #472d2e;
        }
  
        /***** My Account *****/
  
        body.dark-mode .rc-form-legend,
        body.dark-mode .rc-form-label {
            color: var(--primary-font-color);
        }
  
        body.dark-mode .js-logout {
            color: var(--primary-font-color);
            border-color: var(--primary-font-color);
        }
  
        /* Security - 2FA */
        body.dark-mode .rcx-css-9zx50y, body.dark-mode .rcx-css-zl15hy {
            background-color: transparent !important;
        }
  
        /***** Omnichannel *****/
  
        body.dark-mode .rcx-css-110cgdy {
            background-color: transparent !important;
        }
  
        /************** Admin panel & Account panel ******************/
  
        .page-list a:not(.rc-button), .page-settings a:not(.rc-button) {
            color: var(--primary-font-color);
        }
  
        /*body.dark-mode .simplebar-content > .rcx-box => will also modify sidebar background */
        body.dark-mode .simplebar-content > .rcx-css-fr02gd { /* main content */
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rcx-css-txktj6 { /* Account settings page background */
            background-color: var(--color-dark) !important;
        }
  
        body.dark-mode .rcx-css-1wm5na { /* Account settings page header title */
            color: var(--primary-font-color) !important;
        }
  
        body.dark-mode .rc-scrollbars-container { /* Panels sidebar */
            background-color: var(--sidebar-background);
        }
  
        body.dark-mode .rcx-css-15hfnte {  /* Panels sidebar header */
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rcx-css-10ij0kz .rcx-box { /* Panels sidebar header text and button (with cross icon) */
            color: var(--primary-font-color) !important;
        }
  
        body.dark-mode .rcx-css-1l00c5f,
        body.dark-mode .rcx-css-1ky5rco { /* Panels sidebar item */
            color: var(--rcx-sidebar-item-color,var(--rcx-color-foreground-hint,#9ea2a8)) !important;
        }
  
        body.dark-mode .rcx-css-1l00c5f.active { /* Panels sidebar item selected */
            background-color: rgba(108, 114, 122, 0.3);
        }
  
        body.dark-mode .rcx-css-1l00c5f:hover, .rcx-css-1l00c5f:focus, .rcx-css-1l00c5f.active:focus, .rcx-css-1l00c5f.active:hover { /* Panels sidebar item hovered */
            background-color: var(--color-darkest);
        }
  
        body.dark-mode .rcx-css-kyq2rf { /* Admin panel info & stats (Deployment, License, Usage) */
            background-color: var(--color-dark) !important;
        }
  
        body.dark-mode .rcx-css-61di5s { /* Admin panel info & stats (Deployment, License, Usage) */
            color: var(--color-gray) !important;
        }
  
        body.dark-mode .rcx-pagination__link:disabled { /* Admin panel pagination (e.g., in App Marketplace) */
            color: var(--color-white);
        }
  
        body.dark-mode .rcx-select__item {
            color: var(--primary-font-color) !important;
        }
  
        body.dark-mode .sidebar-flex__header {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .sidebar-light {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rcx-accordion-item__title,
        body.dark-mode .rcx-label__text,
        body.dark-mode .rcx-field__label{
            color: var(--color-white);
        }
  
        body.dark-mode .sidebar-flex__search .rc-input__element {
            color: var(--color-dark);
        }
  
        body.dark-mode .rcx-input-box__wrapper {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rcx-box * .rcx-input-box {
            background-color: var(--color-dark);
            color: var(--rc-color-primary);
        }
  
        /* .rcx-autocomplete, .rcx-input-box:not(.rcx-input-box--undecorated), .rcx-input-box__wrapper, .rcx-select */
        body.dark-mode .rcx-autocomplete {
            background-color: transparent;
        }
  
        body.dark-mode .rcx-table__cell {
            color: var(--color-gray) !important;
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rcx-table__cell--header {
            color: var(--color-gray-lightest) !important;
        }
  
        body.dark-mode .rcx-table__cell--align-end {
            color: var(--color-gray);
            background-color: var(--color-gray);
        }
  
        body.dark-mode .rcx-css-18up6l1,
        body.dark-mode .rcx-css-zvbm6,
        body.dark-mode .rcx-css-n6qrb5 { /* Table cells content text*/
            color: var(--primary-font-color) !important;
        }
  
        body.dark-mode .rc-input__element:disabled{
            background-color: var(--color-gray);
        }
  
        body.dark-mode .admin-table-row {
            background-color: hsl(219, 16%, 25%);
        }
  
        body.dark-mode .sidebar-light .sidebar-item {
            color: inherit;
        }
  
        body.dark-mode .admin-table-row:nth-child(even) {
            background-color: hsl(219, 15%, 33%);
        }
  
        body.dark-mode .permissions-manager .permission-grid .id-styler {
            color: var(--info-font-color);
        }
  
        body.dark-mode .rcx-accordion-item__bar:hover {
            background-color: var(--color-dark-30);
        }
  
        body.dark-mode .rcx-box--text-style-h1,
        body.dark-mode .rcx-subtitle,
        body.dark-mode .rcx-box--text-color-default,
        body.dark-mode .rcx-box--text-color-info {
            color: var(--color-gray-lightest);
        }
  
        body.dark-mode .permissions-manager .permission-grid .role-name {
            background: var(--color-dark);
        }
  
        body.dark-mode .rc-apps-marketplace .rc-table-content tbody .rc-table-tr:not(.table-no-click):not(.table-no-pointer):hover,
        body.dark-mode .rc-apps-section .rc-table-content tbody .rc-table-tr:not(.table-no-click):not(.table-no-pointer):hover {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rc-apps-marketplace .rc-table-content .rc-table-info .rc-apps-categories .rc-apps-category,
        body.dark-mode .rc-apps-section .rc-table-content .rc-table-info .rc-apps-categories .rc-apps-category {
            color: var(--primary-font-color);
            background-color: var(--color-dark-medium);
        }
  
        /*body.dark-mode .rcx-box * .rcx-input-box,*/
        body.dark-mode .rcx-box * .rcx-select {
            /*color: var(--color-dark-medium);*/
            background-color: var(--color-white);
        }
  
        body.dark-mode .rcx-banner {
            background-color: var(--color-dark-medium);
            color: var(--info-font-color) !important;
        }
  
        body.dark-mode .rcx-banner__close-button .rcx-button:hover {
            background-color: var(--color-dark-light);
            border: none;
        }
  
        body.dark-mode .mail-messages__instructions {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rcx-tag--secondary {
            background-color: var(--color-dark-medium);
        }
  
        body.dark-mode .rcx-table__cell--align-end {
        color: var(--info-font-color) !important;
            background-color: var(--color-dark-medium) !important;
        }
  
        /* Apply info (white) font *everywhere* */
        body.dark-mode .rcx-css-ps0pgs, /* Channel name */
        body.dark-mode .rcx-room-header  .rcx-box:not(.rcx-button-group):not(.rcx-button):not(.rcx-css-1fgkscl):not(.rcx-css-4pvxx3), /* omit buttons/icons (.rcx-css-1fgkscl is .rcx-icon parent) */
        body.dark-mode .rcx-vertical-bar .rcx-box:not(.rcx-button-group):not(.rcx-button):not(.rcx-css-1fgkscl):not(.rcx-css-4pvxx3):not(.rcx-css-trljwa) {
        color: var(--info-font-color) !important;
            /*background-color: var(--color-darkest) !important;*/
        }
  
        /* body.dark-mode .main-content .rcx-box {
            color: var(--info-font-color) !important;
            background-color: var(--color-dark) !important;
        } */
  
        /* body.dark-mode .rcx-modal__backdrop {
            background-color: transparent !important;
        } */
  
        body.dark-mode .rcx-table__cell--align-start {
        color: var(--info-font-color) !important;
        background-color: var(--color-dark-medium) !important;
        }
  
        body.dark-mode  .rcx-field__description code {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .table-fake-th {
            color: var(--info-font-color);
        }
  
        body.dark-mode .rc-input__element {
            background-color: var(--color-dark-medium);
            color: var(--info-font-color) !important;
        }
  
        body.dark-mode .rcx-check-box.is-focused,
        body.dark-mode .rcx-check-box__input:checked+.rcx-check-box__fake,
        body.dark-mode .rcx-check-box.is-focused,
        body.dark-mode .rcx-check-box__input:indeterminate+.rcx-check-box__fake,
        body.dark-mode .rcx-check-box__input:checked:focus+.rcx-check-box__fake,
        body.dark-mode .rcx-check-box__input:indeterminate:focus+.rcx-check-box__fake,
        body.dark-mode .rcx-radio-button.is-focused
        body.dark-mode .rcx-radio-button__input:checked+.rcx-radio-button__fake,
        body.dark-mode .rcx-radio-button__input:checked:focus+.rcx-radio-button__fake,
        body.dark-mode .rcx-toggle-switch.is-focused
        body.dark-mode .rcx-toggle-switch__input:checked+.rcx-toggle-switch__fake,
        body.dark-mode .rcx-toggle-switch__input:checked:focus+.rcx-toggle-switch__fake {
            background-color: #1d74f5 !important;
        }
  
        body.dark-mode .CodeMirror {
            background-color: var(--color-gray-light);
        }
  
        body.dark-mode .CodeMirror-gutter {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .setting-action {
            border: var(--button-border-width) solid var(--info-font-color);
            color: var(--info-font-color);
        }
  
  
        /**************Login Page******************/
  
        body.dark-mode main#rocket-chat {
            background-color: var(--color-dark);
        }
  
        body.dark-mode section.full-page.color-tertiary-font-color {
            background-color: var(--color-dark);
        }
  
        body.dark-mode .rc-button.rc-button--nude.forgot-password,
        body.dark-mode .rc-button.rc-button--nude.back-to-login,
        body.dark-mode .rc-button.rc-button--nude.register,
        body.dark-mode .rc-button.rc-button--nude i.icon-cancel,
        body.dark-mode .register-link-replacement {
            color: var(--color-white);
        }
  
        body.dark-mode #login-card {
            background-color: var(--color-darkest);
        }
  
  
        /**************Scrollbars******************/
        body.dark-mode .main-content *::-webkit-scrollbar {
            background-color: rgba(255, 255, 255, 0.05);
        }
  
        body.dark-mode .main-content  *::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.15);
        }
  
        body.dark-mode .main-content  *::-webkit-scrollbar-corner {
            background-color: rgba(255, 255, 255, 0.05);
        }
  
        /***** Poll App *****/
        body.dark-mode .rcx-css-erwtrf {
            color: var(--primary-font-color) !important; 
        }
  
        /* Style the browser scroll bars to avoid visually clashing with the rest of Rocket.Chat in dark mode. */
  
        /*
        body.dark-mode * {
            scrollbar-color: #777 transparent;
        }
        */
  
        body.dark-mode *::-webkit-scrollbar {
            width: .75rem;
        }
  
        body.dark-mode *::-webkit-scrollbar-track {
            background-color: transparent;
        }
  
        body.dark-mode *::-webkit-scrollbar-thumb {
            background-color: #777;
        }
  
        /* Firefox does the dimming on hover automatically. We emulate it for Webkit-based browsers. */
        body.dark-mode *::-webkit-scrollbar-thumb:hover {
            background-color: #666;
        }
  
        body.dark-mode *::-webkit-scrollbar-thumb:active {
            background-color: #444;
        }
  
        /***** Changes for 3.9.1 *****/
  
        /* aside.sidebar--main .rcx-sidebar-topbar .rcx-button--small-square {
            width: 1.35rem;
        }
        body.dark-mode .main-content .rcx-box {
            color: var(--info-font-color) !important;
            background-color: var(--color-darkest) !important;
        }
        body.dark-mode div[class*="user-card"] {
            color: var(--info-font-color) !important;
            background-color: var(--color-dark) !important;
        }
        body.dark-mode .rcx-box {
            color: var(--info-font-color) !important;
            background-color: var(--color-dark-medium);
        }
        body.dark-mode .rcx-status-bullet--online {
        background: #2de0a5 !important;
        }
        body.dark-mode .rcx-box--full {
            background-color: var(--color-dark);
        }
        body.dark-mode .rc-box.rcx-box--full.rcx-sidebar-item__title,
        body.dark-mode .rc-box.rcx-box--full.rcx-sidebar-item__subtitle,
        body.dark-mode .rc-box.rcx-box--full.rcx-sidebar-item__time {
            color: var(--sidebar-item-text-color);
        }
        body.dark-mode .rcx-sidebar-topbar button.rcx-button-group__item .rcx-icon,
        body.dark-mode .rcx-box.rcx-box--full.rcx-icon--name-hashtag,
        body.dark-mode .rcx-box.rcx-box--full.rcx-sidebar-title {
            color: var(--sidebar-item-text-color) !important;
        }
        body.dark-mode .rcx-sidebar-item--highlighted {
            color: #fff !important;
        }
        body.dark-mode .rcx-sidebar-item__container span.rcx-box.rcx-box--full.rcx-badge {
            background-color: var(--rc-color-alert);
        } */
  
        body.dark-mode figcaption.rcx-box.rcx-box--full.rcx-attachment__details {
            background-color: var(--color-darker) !important;
            color: var(--primary-font-color) !important;
        }
  
        body.dark-mode .rcx-css-z2kk2c {
            color: var(--primary-font-color) !important;
        }
  
        body.dark-mode .rcx-box--with-inline-elements code, .rcx-field__description code, .rcx-field__error code, .rcx-field__hint code{
            background-color: var(--color-dark-100) !important;
            color: var(--primary-font-color) !important;
        }
        
        body.dark-mode .user.user-card-message {
            color: #929292 !important;
        }
  
        body.dark-mode .role-tag {
            color: #a72525 !important;
        }
        
        body.dark-mode .rcx-message-body{
            color: var(--rcx-color-foreground-default);
        }

        body.dark-mode .rcx-message-generic-preview {
            border-color: var(--color-dark-medium);
        }

        body.dark-mode .rcx-message-generic-preview__content {
            background-color: var(--color-dark-medium);
        }

        body.dark-mode .rcx-message-reactions__reaction--mine{
            background-color: var(--color-dark-medium);
            border-color: var(--color-dark-medium);

        }

        body.dark-mode .rcx-message-reactions__reaction--action {
            border-color: var(--color-dark-medium);
        }

        body.dark-mode .rcx-message-reactions__reaction--action:hover {
            border-color: var(--color-dark);
            background-color: var(--color-dark);
            color: white;
        }
        body.dark-mode .rcx-message-reactions__reaction {
            border-color: var(--color-dark);
        }
        body.dark-mode .rcx-message-reactions__reaction:hover {
            border-color: var(--color-dark);
            background-color: var(--color-dark);
        }



        body.dark-mode .rcx-message-toolbox {
            background-color: var(--color-dark-medium);
            border-color: var(--color-dark);
        }

        body.dark-mode .rcx-message-header__role {
            background-color: #a72525;
            color: white;
        }

        body.dark-mode .rcx-message-divider__bar:after {
            background: var(--color-dark-medium);
        }

        body.dark-mode i.rcx-box.rcx-box--full.rcx-icon--name-star-filled.rcx-icon.rcx-css-1g87xs3 {
            color: rgb(255, 208, 49) !important;
        }

        /* This CSS block is used to counter RocketChat's bug which crop the end of custom CSS. */
        .dummy-entry {
            color: whitesmoke;
        }            
        `;
  
        document.body.appendChild(newStyle)
        setTimeout(function(){
            let style2 = document.createElement("style");
            style2.innerHTML = `
            body.dark-mode i.rcx-box.rcx-box--full.rcx-icon--name-star-filled.rcx-icon.rcx-css-1g87xs3 {
                color: rgb(255, 208, 49) !important;
            }
    
            /* This CSS block is used to counter RocketChat's bug which crop the end of custom CSS. */
            .dummy-entry2 {
                color: whitesmoke;
            }    
            `;
            
            document.body.appendChild(style2)
        },4000)
        const darkModeDefault = 'auto';
  
        // CSS class used to set Dark Mode properties
        const DARK_MODE_CSS = 'dark-mode';
  
        // LocalStorage key used to store Dark Mode state
        const DARK_MODE_STORAGE = 'dark-mode';
  
        // CSS id used for Dark Mode icon
        const DARK_MODE_ICON = "icon-darkmode"; // could be `icon-${DARK_MODE_CSS}`;
  
        // CSS id used for Dark Mode button
        const DARK_MODE_BUTTON = "dark-mode-button"; // could be `button-${DARK_MODE_CSS}`;
  
        const DARK_MODE_MODES = ["auto", "dark", "light"];
  
        const systemModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  
        const modeSymbols = {
            'dark': `<svg id="${DARK_MODE_ICON}" viewBox="0 0 468 468" fill="currentColor">  <path d="M428.756 300.104c-.664-3.81-2.334-7.047-4.996-9.713-5.9-5.903-12.752-7.142-20.554-3.716-20.937 9.708-42.641 14.558-65.097 14.558-28.171 0-54.152-6.94-77.943-20.838-23.791-13.894-42.631-32.736-56.525-56.53-13.899-23.793-20.844-49.773-20.844-77.945 0-21.888 4.333-42.683 12.991-62.384 8.66-19.7 21.176-36.973 37.543-51.82 6.283-5.898 7.713-12.752 4.287-20.557-3.236-7.801-9.041-11.511-17.415-11.132-29.121 1.141-56.72 7.664-82.797 19.556C111.33 31.478 88.917 47.13 70.168 66.548c-18.747 19.414-33.595 42.399-44.54 68.95-10.942 26.553-16.416 54.39-16.416 83.511 0 29.694 5.806 58.054 17.416 85.082 11.613 27.028 27.218 50.344 46.824 69.949 19.604 19.599 42.92 35.207 69.951 46.822 27.028 11.607 55.384 17.415 85.075 17.415 42.64 0 81.987-11.563 118.054-34.69 36.069-23.124 63.05-54.006 80.944-92.645 1.524-3.423 1.951-7.036 1.28-10.838zm-122.191 84.064c-24.646 11.711-50.676 17.562-78.087 17.562-24.743 0-48.39-4.853-70.947-14.558-22.554-9.705-41.971-22.695-58.246-38.972-16.271-16.272-29.259-35.686-38.97-58.241-9.707-22.556-14.561-46.203-14.561-70.948 0-40.922 12.135-77.466 36.403-109.636 24.266-32.165 55.531-53.959 93.788-65.379-19.795 31.405-29.694 65.379-29.694 101.926 0 34.644 8.564 66.715 25.697 96.223 17.128 29.499 40.446 52.811 69.95 69.948 29.499 17.129 61.565 25.694 96.211 25.694 10.656 0 21.129-.855 31.408-2.57-17.318 20.938-38.307 37.255-62.952 48.951z"/></svg>`, // moon icon
            'light': `<svg  id="${DARK_MODE_ICON}" viewBox="0 0 302.4 302.4" fill="currentColor"> <path d="M204.8 97.6C191.2 84 172 75.2 151.2 75.2s-40 8.4-53.6 22.4c-13.6 13.6-22.4 32.8-22.4 53.6s8.8 40 22.4 53.6c13.6 13.6 32.8 22.4 53.6 22.4s40-8.4 53.6-22.4c13.6-13.6 22.4-32.8 22.4-53.6s-8.4-40-22.4-53.6zm-14.4 92.8c-10 10-24 16-39.2 16s-29.2-6-39.2-16-16-24-16-39.2 6-29.2 16-39.2 24-16 39.2-16 29.2 6 39.2 16 16 24 16 39.2-6 29.2-16 39.2zM292 140.8h-30.8c-5.6 0-10.4 4.8-10.4 10.4 0 5.6 4.8 10.4 10.4 10.4H292c5.6 0 10.4-4.8 10.4-10.4 0-5.6-4.8-10.4-10.4-10.4zM151.2 250.8c-5.6 0-10.4 4.8-10.4 10.4V292c0 5.6 4.8 10.4 10.4 10.4 5.6 0 10.4-4.8 10.4-10.4v-30.8c0-5.6-4.8-10.4-10.4-10.4zM258 243.6l-22-22c-3.6-4-10.4-4-14.4 0s-4 10.4 0 14.4l22 22c4 4 10.4 4 14.4 0s4-10.4 0-14.4zM151.2 0c-5.6 0-10.4 4.8-10.4 10.4v30.8c0 5.6 4.8 10.4 10.4 10.4 5.6 0 10.4-4.8 10.4-10.4V10.4c0-5.6-4.8-10.4-10.4-10.4zM258.4 44.4c-4-4-10.4-4-14.4 0l-22 22c-4 4-4 10.4 0 14.4 3.6 4 10.4 4 14.4 0l22-22c4-4 4-10.4 0-14.4zM41.2 140.8H10.4c-5.6 0-10.4 4.8-10.4 10.4s4.4 10.4 10.4 10.4h30.8c5.6 0 10.4-4.8 10.4-10.4 0-5.6-4.8-10.4-10.4-10.4zM80.4 221.6c-3.6-4-10.4-4-14.4 0l-22 22c-4 4-4 10.4 0 14.4s10.4 4 14.4 0l22-22c4-4 4-10.4 0-14.4zM80.4 66.4l-22-22c-4-4-10.4-4-14.4 0s-4 10.4 0 14.4l22 22c4 4 10.4 4 14.4 0s4-10.4 0-14.4z"/> </svg>`, // sun icon
            'auto': `<svg id="${DARK_MODE_ICON}" viewBox="0 0 302.4 302.4" fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"> <path d="m 117.87754,56.176017 c -7.8278,-7.827806 -18.878822,-12.892856 -30.85076,-12.892856 -11.971937,0 -23.022957,4.83482 -30.850763,12.892856 -7.827806,7.827806 -12.892856,18.878826 -12.892856,30.850763 0,11.971938 5.06505,23.02296 12.892856,30.85076 7.827806,7.82781 18.878826,12.89287 30.850763,12.89287 11.971938,0 23.02296,-4.83483 30.85076,-12.89287 7.82781,-7.8278 12.89287,-18.878822 12.89287,-30.85076 0,-11.971937 -4.83483,-23.022957 -12.89287,-30.850763 z m -8.28826,53.413263 c -5.75574,5.75574 -13.813776,9.20918 -22.5625,9.20918 -8.748724,0 -16.806759,-3.45344 -22.562498,-9.20918 -5.75574,-5.75574 -9.209184,-13.813776 -9.209184,-22.5625 0,-8.748724 3.453444,-16.806759 9.209184,-22.562498 5.755739,-5.75574 13.813774,-9.209184 22.562498,-9.209184 8.748724,0 16.80676,3.453444 22.5625,9.209184 5.75574,5.755739 9.20918,13.813774 9.20918,22.562498 0,8.748724 -3.45344,16.80676 -9.20918,22.5625 z m 58.47831,-28.548469 h -17.72768 c -3.22321,0 -5.98597,2.762755 -5.98597,5.985969 0,3.223214 2.76276,5.98597 5.98597,5.98597 h 17.72768 c 3.22322,0 5.98598,-2.762756 5.98598,-5.98597 0,-3.223214 -2.76276,-5.985969 -5.98598,-5.985969 z M 87.02678,144.35394 c -3.223214,0 -5.985969,2.76276 -5.985969,5.98597 v 17.72768 c 0,3.22322 2.762755,5.98598 5.985969,5.98598 3.223214,0 5.98597,-2.76276 5.98597,-5.98598 v -17.72768 c 0,-3.22321 -2.762756,-5.98597 -5.98597,-5.98597 z m 61.47129,-4.14413 -12.66262,-12.66262 c -2.07207,-2.3023 -5.98597,-2.3023 -8.28826,0 -2.3023,2.30229 -2.3023,5.98596 0,8.28826 l 12.66262,12.66262 c 2.3023,2.3023 5.98597,2.3023 8.28826,0 2.3023,-2.30229 2.3023,-5.98596 0,-8.28826 z M 87.02678,0 c -3.223214,0 -5.985969,2.7627549 -5.985969,5.985969 v 17.727677 c 0,3.223214 2.762755,5.98597 5.985969,5.98597 3.223214,0 5.98597,-2.762756 5.98597,-5.98597 V 5.985969 C 93.01275,2.7627549 90.249994,0 87.02678,0 Z m 61.70153,25.555483 c -2.3023,-2.302296 -5.98597,-2.302296 -8.28827,0 L 127.77742,38.21811 c -2.3023,2.302295 -2.3023,5.985968 0,8.288265 2.07206,2.302295 5.98596,2.302295 8.28826,0 l 12.66263,-12.662628 c 2.30229,-2.302295 2.30229,-5.985968 0,-8.288264 z M 23.713646,81.040811 H 5.985969 C 2.7627549,81.040811 0,83.803566 0,87.02678 c 0,3.223214 2.5325254,5.98597 5.985969,5.98597 h 17.727677 c 3.223214,0 5.98597,-2.762756 5.98597,-5.98597 0,-3.223214 -2.762756,-5.985969 -5.98597,-5.985969 z m 22.562499,46.506379 c -2.072067,-2.3023 -5.98597,-2.3023 -8.288265,0 l -12.662626,12.66262 c -2.302297,2.3023 -2.302297,5.98597 0,8.28826 2.302295,2.3023 5.985968,2.3023 8.288264,0 l 12.662627,-12.66262 c 2.302296,-2.3023 2.302296,-5.98597 0,-8.28826 z m 0,-89.32908 -12.662627,-12.662627 c -2.302296,-2.302296 -5.985969,-2.302296 -8.288264,0 -2.302297,2.302296 -2.302297,5.985969 0,8.288264 L 37.98788,46.506375 c 2.302295,2.302295 5.98597,2.302295 8.288265,0 2.302296,-2.302297 2.302296,-5.98597 0,-8.288265 z"/> <path d="m 301.90371,249.29701 c -0.25471,-1.46156 -0.89535,-2.7033 -1.91652,-3.726 -2.26329,-2.26446 -4.89179,-2.73976 -7.88472,-1.4255 -8.03165,3.72408 -16.35753,5.58459 -24.97188,5.58459 -10.8067,0 -20.77328,-2.66225 -29.89975,-7.99367 -9.12648,-5.32988 -16.3537,-12.55787 -21.68358,-21.68549 -5.3318,-9.12725 -7.99597,-19.09345 -7.99597,-29.90052 0,-8.39646 1.66218,-16.37364 4.98348,-23.93115 3.32207,-7.55712 8.12333,-14.18322 14.40188,-19.87869 2.41023,-2.26253 2.95879,-4.8918 1.64454,-7.88588 -1.24137,-2.99254 -3.46822,-4.41574 -6.68058,-4.27035 -11.17111,0.4377 -21.75837,2.93999 -31.76179,7.50188 -10.00302,4.56305 -18.60088,10.56732 -25.7932,18.01627 -7.19154,7.44741 -12.88739,16.26469 -17.086,26.44994 -4.19747,10.186 -6.29735,20.86457 -6.29735,32.03569 0,11.39092 2.22725,22.27012 6.68096,32.63833 4.45487,10.36822 10.4411,19.31249 17.96217,26.83317 7.5203,7.51837 16.46457,13.50577 26.83393,17.96141 10.36824,4.45256 21.24589,6.68057 32.63566,6.68057 16.35715,0 31.45107,-4.43569 45.28675,-13.30744 13.83644,-8.87061 24.18663,-20.71727 31.05096,-35.53959 0.58462,-1.3131 0.74841,-2.69909 0.49101,-4.15757 z m -46.87373,32.24782 c -9.45446,4.49247 -19.43985,6.73697 -29.95499,6.73697 -9.49167,0 -18.5629,-1.86167 -27.21601,-5.5846 -8.65194,-3.72294 -16.1005,-8.70604 -22.34377,-14.95006 -6.24172,-6.24212 -11.22406,-13.68953 -14.9493,-22.34186 -3.7237,-8.65271 -5.58575,-17.72395 -5.58575,-27.21639 0,-15.69811 4.65511,-29.71676 13.96458,-42.05751 9.30868,-12.33883 21.30227,-20.69923 35.97805,-25.08007 -7.59358,12.04729 -11.39093,25.08007 -11.39093,39.09988 0,13.2898 3.28524,25.59256 9.85764,36.91214 6.57048,11.31612 15.5155,20.25885 26.83355,26.83278 11.31612,6.57087 23.61696,9.85649 36.90754,9.85649 4.08775,0 8.1053,-0.32798 12.04843,-0.98588 -6.64336,8.03204 -14.69496,14.2914 -24.14904,18.77811 z" /></svg>` // sun / moon icon
        }
  
        const darkModeToggleText = {
            'en': 'Toggle Dark Mode',
            'de': 'Dark Mode umschalten',
            'fr': 'Activer le mode sombre',
            'es': 'Alternar Modo Obscuro',
            'hu': 'Sötét mód be/ki',
            'it': 'Attiva/Disattiva modalità scura',
            'nl': 'Toggle Dark Mode',
            'pl': 'Toggle Dark Mode',
            'pt': 'Alternar Modo Escuro',
            'ru': 'Смена оформления',
            'he': 'מצב לילה',
            'hi': 'डार्क मोड',
            'zh': '切换暗色主题'
        }[defaultUserLanguage()] || 'Toggle Dark Mode';
  
        const normalModeSidebarSelector = '.rcx-sidebar-topbar .rcx-button-group';
        const embeddedModeSidebarSelector = '.rcx-room-header .rcx-button-group';
  
        let addDarkModeToggleRetryCount = 0;
        const addDarkModeToggleRetryMax = 10;
  
        const toggleButton = `<button id="${DARK_MODE_BUTTON}" class="rcx-box rcx-box--full rcx-button--small-square rcx-button--square rcx-button--icon rcx-button  rcx-button-group__item rcx-@ue04p" aria-label="${darkModeToggleText}">D</button>`;
  
        function getDarkModeSetting() {
            let mode = localStorage.getItem(DARK_MODE_STORAGE);
            if (mode === null || DARK_MODE_MODES.indexOf(mode) == -1) {
                // If the setting is missing or not one of the valid options initialize storage to the default
                localStorage.setItem(DARK_MODE_STORAGE, darkModeDefault);
            }
            return localStorage.getItem(DARK_MODE_STORAGE);
        }
  
        function getDarkModeIcon() {
            return `<svg class="rcx-box rcx-box--full rcx-icon--name-darkmode rcx-icon rcx-@4pvxx3" aria-hidden="true">
            <use xlink:href="#${DARK_MODE_ICON}"></use>
            ${modeSymbols[getDarkModeSetting()]}
        </svg>`;
        }
  
        function toggleDarkMode() {
            // Cycle through modes
            const nextMode = DARK_MODE_MODES[(DARK_MODE_MODES.indexOf(getDarkModeSetting()) + 1) % DARK_MODE_MODES.length];
            localStorage.setItem(DARK_MODE_STORAGE, nextMode);
            maybeModeChange();
            updateButton(nextMode);
        }
  
        function switchToMode(targetMode :any) {
            if (targetMode == 'dark') {
                document.body.classList.add(DARK_MODE_CSS);
            } else {
                document.body.classList.remove(DARK_MODE_CSS);
            }
        }
  
        function maybeModeChange() {
            const userMode = getDarkModeSetting();
            const systemMode = (systemModeMediaQuery.matches ? 'dark' : 'light');
  
            if (userMode === "auto") {
                switchToMode(systemMode);
            } else {
                switchToMode(userMode);
            }
        }
  
        function updateButton(mode :any) {
            const darkModeButton = $(`#${DARK_MODE_BUTTON}`);
            darkModeButton.html(getDarkModeIcon());
            darkModeButton.attr('data-title', `${darkModeToggleText}, current: ${mode}`);
        }
  
        function addDarkModeToggle() {
            const sidebarToolbar = ($(normalModeSidebarSelector).length > 0)
                                ? $(normalModeSidebarSelector).first()
                                : $(embeddedModeSidebarSelector).first();
  
            // wait for the sidebar toolbar to be visible
            // this will also be false if the toolbar doesn't exist yet
            if(!sidebarToolbar.is(':visible') && addDarkModeToggleRetryCount < addDarkModeToggleRetryMax) {
                setTimeout(addDarkModeToggle, 250);
                addDarkModeToggleRetryCount += 1;
                return;
            }
  
            var darkModeButton = $(`#${DARK_MODE_BUTTON}`);
  
            // do nothing if button is already on the screen
            if (darkModeButton.is(':visible')) {
                return;
            }
  
            darkModeButton = $(toggleButton).prependTo(sidebarToolbar);
            updateButton(getDarkModeSetting());
  
            darkModeButton.on('click', function() {
                toggleDarkMode();
                $(this).blur();
            });
        }
  
        // Switch mode on system theme changes
        systemModeMediaQuery.addEventListener("change", maybeModeChange);
  
        // Trigger initial mode change if necessary
        maybeModeChange();
  
        // Add toggle button
        $(addDarkModeToggle);
  }
  start();
  injectDarkMode()
