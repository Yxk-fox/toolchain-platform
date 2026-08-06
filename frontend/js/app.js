/*
@File    :  app.js
@Time    :  2026/08/05 17:15:16
@Author  :  fox
@Version :  4.0
@Desc    :  伯镭工具链平台前端主应用，实现页面路由、环境/工具/程序管理、
           用户认证、状态展示、收藏夹、工具箱、系统设置等核心交互逻辑
*/
(function() {
  'use strict';

  var API_BASE = '/api';
  var WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/status';

  var appState = {
    data: { envs: [], tools: [], categories: {}, favorites: { envs: [], tools: [], toolbox: [], programs: [], services: [] }, history: [], settings: {}, quickEntries: [], envGroups: [], toolboxGroups: [], mineGroups: [], menuOrder: [], scripts: [], programs: [], programCategories: [], toolCompanyGroups: [], toolTags: [] },
    envStatuses: {},
    wsConnected: false,
    currentOs: 'windows',
    currentCategory: '',
    currentCompanyGroup: '',
    currentTag: '',
    toolView: 'grid',
    theme: 'light',
    primaryColor: '#4f46e5',
    authToken: null,
    currentUser: null,
    hideOfflineEnvs: false,
    dataLoaded: false,
    dataLoadTime: 0,
    dataLoadPromise: null,
    dataLoadMode: ''
  };

  var PAGE_CONFIG = {
    home:      { name: '首页',          icon: 'fa-house' },
    urls:      { name: '网址大全',      icon: 'fa-earth-asia' },
    services:  { name: '服务目录',      icon: 'fa-sitemap' },
    tools:     { name: '软件管家',      icon: 'fa-screwdriver-wrench' },
    programs:  { name: '自研程序',      icon: 'fa-cube' },
    toolbox:   { name: '工具箱',        icon: 'fa-toolbox' },
    favorites: { name: '我的收藏',      icon: 'fa-star' },
    alerts:    { name: '告警中心',      icon: 'fa-bell' },
    recycle:   { name: '资源回收',      icon: 'fa-recycle' },
    api:       { name: 'REST API 管理', icon: 'fa-satellite-dish' },
    settings:  { name: '系统设置',      icon: 'fa-gear' },
    users:     { name: '用户管理',      icon: 'fa-users' }
  };
  var DEFAULT_MENU_ORDER = ['home', 'urls', 'services', 'tools', 'programs', 'toolbox', 'favorites', 'alerts', 'recycle', 'api', 'settings', 'users'];
  var ADMIN_PAGES = ['users', 'settings'];
  var DEFAULT_USER_PAGES = ["home", "urls", "services", "tools", "programs", "toolbox", "favorites", "alerts", "recycle"];

  var iconData = {
    solid: ['fa-house','fa-user','fa-heart','fa-star','fa-star-half-stroke','fa-bell','fa-envelope','fa-search','fa-gear','fa-trash','fa-pen','fa-plus','fa-minus','fa-check','fa-xmark','fa-arrow-right','fa-arrow-left','fa-upload','fa-download','fa-lock','fa-unlock','fa-eye','fa-eye-slash','fa-copy','fa-paste','fa-link','fa-image','fa-file','fa-folder','fa-cloud','fa-database','fa-code','fa-terminal','fa-bug','fa-wrench','fa-hammer','fa-paintbrush','fa-palette','fa-chart-bar','fa-chart-line','fa-table','fa-list','fa-list-check','fa-filter','fa-sort','fa-shuffle','fa-rotate-right','fa-spinner','fa-circle','fa-square','fa-play','fa-pause','fa-stop','fa-forward','fa-backward','fa-volume-up','fa-volume-down','fa-volume-x','fa-music','fa-film','fa-camera','fa-wifi','fa-signal','fa-battery-full','fa-battery-half','fa-battery-empty','fa-plug','fa-lightbulb','fa-sun','fa-moon','fa-fire','fa-snowflake','fa-car','fa-plane','fa-rocket','fa-anchor','fa-map','fa-globe','fa-flag','fa-bookmark','fa-tag','fa-comment','fa-share','fa-thumbs-up','fa-thumbs-down','fa-trophy','fa-medal','fa-crown','fa-gem','fa-key','fa-shield','fa-user-shield','fa-graduation-cap','fa-certificate','fa-stamp','fa-cube','fa-cubes','fa-layer-group','fa-object-group','fa-box','fa-package','fa-briefcase','fa-coffee','fa-cutlery','fa-pizza-slice','fa-cake','fa-birthday-cake','fa-wine-glass','fa-beer','fa-soda-can','fa-smoking','fa-drumstick-bite','fa-utensils','fa-hamburger','fa-fish','fa-apple','fa-lemon','fa-orange','fa-grape','fa-cherry','fa-peach','fa-banana','fa-watermelon','fa-strawberry','fa-tree','fa-flower','fa-leaf','fa-grass','fa-mountain','fa-sunset','fa-sunrise','fa-cloud-sun','fa-cloud-moon','fa-cloud-rain','fa-cloud-snow','fa-bolt','fa-wind','fa-tornado','fa-umbrella','fa-sunglasses','fa-glasses','fa-hat-cowboy','fa-hat-cowboy-side','fa-shirt','fa-pants','fa-shoe-prints','fa-socks','fa-glove','fa-watch','fa-ring','fa-bracelet','fa-necklace','fa-headphones','fa-microphone','fa-headset','fa-phone','fa-phone-volume','fa-mobile-screen-button','fa-tablet-screen-button','fa-laptop','fa-desktop','fa-tv','fa-radio','fa-cd','fa-floppy-disk','fa-hard-drive','fa-memory-stick','fa-usb','fa-printer','fa-scanner','fa-projector','fa-monitor','fa-keyboard','fa-mouse','fa-trackpad','fa-gamepad','fa-joystick','fa-controller','fa-vr-cardboard','fa-arrows','fa-arrow-up','fa-arrow-down','fa-arrow-left-right','fa-arrow-up-down','fa-arrow-pointer','fa-arrow-turn-up','fa-arrow-turn-down','fa-arrow-right-from-line','fa-arrow-right-to-line','fa-arrow-left-from-line','fa-arrow-left-to-line','fa-arrow-up-from-line','fa-arrow-up-to-line','fa-arrow-down-from-line','fa-arrow-down-to-line','fa-arrow-up-right-from-square','fa-arrow-up-left-from-square','fa-arrow-down-right-from-square','fa-arrow-down-left-from-square','fa-arrow-up-right','fa-arrow-up-left','fa-arrow-down-right','fa-arrow-down-left','fa-arrow-right-long','fa-arrow-left-long','fa-arrow-up-long','fa-arrow-down-long','fa-arrow-right-short','fa-arrow-left-short','fa-arrow-up-short','fa-arrow-down-short','fa-chevron-right','fa-chevron-left','fa-chevron-up','fa-chevron-down','fa-angle-right','fa-angle-left','fa-angle-up','fa-angle-down','fa-circle-right','fa-circle-left','fa-circle-up','fa-circle-down','fa-square-right','fa-square-left','fa-square-up','fa-square-down','fa-caret-right','fa-caret-left','fa-caret-up','fa-caret-down','fa-hand-pointer','fa-hand','fa-hand-back-fist','fa-hand-peace','fa-hand-heart','fa-hand-thumbs-up','fa-hand-thumbs-down','fa-hand-clapping','fa-hand-wave','fa-people-group','fa-person','fa-person-standing','fa-person-walking','fa-person-running','fa-person-biking','fa-person-swimming','fa-person-skating','fa-person-skiing','fa-person-snowboarding','fa-person-hiking','fa-person-cane','fa-person-breastfeeding','fa-person-pregnant','fa-user-plus','fa-user-minus','fa-user-check','fa-user-xmark','fa-user-clock','fa-user-lock','fa-user-unlock','fa-user-shield','fa-user-astronaut','fa-user-nurse','fa-user-doctor','fa-user-firefighter','fa-user-police','fa-user-graduate','fa-user-tie','fa-user-suitcase','fa-users','fa-users-line','fa-user-group','fa-user-friends','fa-user-cog','fa-user-pen','fa-user-tag','fa-user-circle','fa-user-circle-check','fa-user-circle-xmark','fa-user-circle-question','fa-user-circle-exclamation','fa-user-rectangle','fa-user-rectangle-history','fa-id-card','fa-id-card-clip','fa-address-card','fa-address-book','fa-calendar','fa-calendar-days','fa-calendar-week','fa-calendar-month','fa-calendar-year','fa-calendar-check','fa-calendar-xmark','fa-calendar-minus','fa-calendar-plus','fa-calendar-clock','fa-calendar-bell','fa-calendar-heart','fa-calendar-star','fa-clock','fa-clock-rotate-left','fa-hourglass','fa-hourglass-start','fa-hourglass-half','fa-hourglass-end','fa-stopwatch','fa-timer','fa-timer-three','fa-timer-ten','fa-alarm-clock','fa-bell-ring','fa-bell-slash','fa-bell-concierge','fa-bullhorn','fa-megaphone','fa-siren','fa-bell-plus','fa-bell-minus','fa-bell-xmark','fa-bell-check','fa-comment-dots','fa-comment-alt','fa-comment-medical','fa-comment-heart','fa-comment-dollar','fa-comment-lines','fa-comments','fa-comments-dollar','fa-comments-heart','fa-message','fa-message-circle','fa-message-square','fa-message-heart','fa-message-exclamation','fa-message-question','fa-message-plus','fa-message-minus','fa-message-xmark','fa-message-check','fa-envelope-open','fa-envelope-circle-check','fa-envelope-circle-exclamation','fa-envelope-heart','fa-envelope-star','fa-envelope-open-text','fa-envelope-arrow-up-right','fa-envelope-arrow-down-left','fa-paper-plane','fa-paper-plane-top','fa-send','fa-send-to','fa-reply','fa-reply-all','fa-forward','fa-email','fa-at','fa-quote-left','fa-quote-right','fa-paragraph','fa-align-left','fa-align-center','fa-align-right','fa-align-justify','fa-list-ol','fa-list-ul','fa-list-checks','fa-list-todo','fa-indent','fa-outdent','fa-line-spacing','fa-text-height','fa-text-width','fa-font','fa-font-awesome','fa-font-plus','fa-font-minus','fa-font-italic','fa-font-bold','fa-font-strikethrough','fa-font-underline','fa-typewriter','fa-keyboard','fa-mouse-pointer','fa-hand-pointer-click','fa-eraser','fa-pencil','fa-pencil-line','fa-pencil-alt','fa-pencil-ruler','fa-pen-nib','fa-pen-fancy','fa-pen-to-square','fa-feather','fa-feather-pointed','fa-highlighter','fa-marker','fa-brush','fa-palette','fa-paint-roller','fa-droplet','fa-spray-can','fa-palette-swatch','fa-eye-dropper','fa-scissors','fa-cut','fa-clipboard','fa-clipboard-check','fa-clipboard-list','fa-clipboard-user','fa-clipboard-arrow-up','fa-clipboard-arrow-down','fa-sticky-note','fa-file-text','fa-file-lines','fa-file-code','fa-file-image','fa-file-video','fa-file-audio','fa-file-pdf','fa-file-word','fa-file-excel','fa-file-powerpoint','fa-file-archive','fa-file-csv','fa-folder-open','fa-folder-plus','fa-folder-minus','fa-folder-xmark','fa-folder-check','fa-folder-tree','fa-box-open','fa-box-plus','fa-box-minus','fa-box-xmark','fa-box-check','fa-package-open','fa-archive','fa-compress','fa-expand','fa-maximize','fa-minimize','fa-restore','fa-resize','fa-resize-horizontal','fa-resize-vertical','fa-arrows-up-down-left-right','fa-arrows-left-right','fa-arrows-up-down','fa-arrows-rotate','fa-arrow-rotate-left','fa-arrow-rotate-right','fa-rotate','fa-rotate-left','fa-rotate-right','fa-flip','fa-flip-horizontal','fa-flip-vertical','fa-flop-horizontal','fa-flop-vertical','fa-shuffle','fa-random','fa-repeat','fa-repeat-1','fa-repeat-1-alt','fa-refresh','fa-refresh-cw','fa-refresh-ccw','fa-sync','fa-sync-alt','fa-spinner','fa-spinner-third','fa-circle-notch','fa-hourglass-half','fa-loader','fa-cog','fa-cogs','fa-gear','fa-gears','fa-wrench','fa-screwdriver','fa-hammer','fa-pliers','fa-toolbox','fa-tools','fa-gauge','fa-gauge-high','fa-gauge-simple','fa-gauge-simple-high','fa-tachometer','fa-speedometer','fa-meter','fa-meter-square','fa-meter-cube','fa-thermometer','fa-thermometer-sun','fa-thermometer-moon','fa-thermometer-half','fa-thermometer-empty','fa-thermometer-full','fa-thermometer-quarters','fa-temperature-high','fa-temperature-low','fa-humidity','fa-wind','fa-droplets','fa-cloud-droplet','fa-cloud-rain','fa-cloud-snow','fa-cloud-lightning','fa-cloud-lightning-rain','fa-sun','fa-moon','fa-star','fa-heart','fa-heart-pulse','fa-heart-crack','fa-flame','fa-flame-flicker','fa-flame-burner','fa-fire','fa-ice-cream','fa-snowflake','fa-snowflake-cold','fa-fog','fa-smoke','fa-smog','fa-dust','fa-tornado','fa-wind-turbine','fa-umbrella','fa-umbrella-beach','fa-sunglasses','fa-glasses','fa-mask','fa-face-smile','fa-face-frown','fa-face-meh','fa-face-grin','fa-face-laugh','fa-face-cry','fa-face-surprise','fa-face-sad-tear','fa-face-wink','fa-face-kiss','fa-face-smile-beam','fa-face-smile-plus','fa-face-frown-open','fa-face-meh-blank','fa-face-grin-wide','fa-face-grin-beam','fa-face-grin-squint','fa-face-grin-hearts','fa-face-laugh-beam','fa-face-laugh-squint','fa-face-cry-bounce','fa-face-surprise-open','fa-face-sad-tear','fa-face-wink-beam','fa-face-kiss-beam','fa-face-kiss-wink-heart','fa-face-dizzy','fa-face-exhausted','fa-face-confused','fa-face-triangle-exclamation','fa-face-circle-exclamation','fa-face-circle-question','fa-face-circle-info','fa-face-circle-xmark','fa-face-circle-check','fa-face-angel','fa-face-devil','fa-face-ghost','fa-face-skull','fa-face-skull-crossbones','fa-hand-dragon','fa-hand-sparkles','fa-hand-cursor-pointer'],
    regular: ['fa-circle','fa-circle-dot','fa-circle-notch','fa-square','fa-square-full','fa-square-check','fa-square-xmark','fa-square-minus','fa-square-plus','fa-square-circle','fa-square-caret-right','fa-square-caret-down','fa-square-caret-up','fa-square-caret-left','fa-square-root','fa-square-h','fa-square-v','fa-square-poll-horizontal','fa-square-poll-vertical','fa-square-arrow-up-right','fa-square-arrow-down-left','fa-square-arrow-up-left','fa-square-arrow-down-right','fa-square-left','fa-square-right','fa-square-up','fa-square-down','fa-square-external-link','fa-square-internal-link','fa-square-phone','fa-square-envelope','fa-square-mail','fa-square-at','fa-square-share-nodes','fa-square-share','fa-square-share-from-square','fa-square-copy','fa-square-cut','fa-square-paste','fa-square-rotate-right','fa-square-rotate-left','fa-square-flip-horizontal','fa-square-flip-vertical','fa-square-shuffle','fa-square-sync','fa-square-spinner','fa-square-cog','fa-square-wrench','fa-square-toolbox','fa-square-hammer','fa-square-screwdriver','fa-square-pliers','fa-square-calendar','fa-square-clock','fa-square-bell','fa-square-envelope-open','fa-square-comment','fa-square-message','fa-square-paper-plane','fa-square-send','fa-square-reply','fa-square-forward','fa-square-quote-left','fa-square-quote-right','fa-square-paragraph','fa-square-list-ul','fa-square-list-ol','fa-square-list-check','fa-square-list-todo','fa-square-indent','fa-square-outdent','fa-square-font','fa-square-pencil','fa-square-pen','fa-square-feather','fa-square-highlighter','fa-square-marker','fa-square-brush','fa-square-palette','fa-square-paint-roller','fa-square-droplet','fa-square-spray-can','fa-square-eye-dropper','fa-square-scissors','fa-square-clipboard','fa-square-sticky-note','fa-square-file','fa-square-file-text','fa-square-file-code','fa-square-file-image','fa-square-file-video','fa-square-file-audio','fa-square-file-pdf','fa-square-file-word','fa-square-file-excel','fa-square-file-powerpoint','fa-square-file-archive','fa-square-file-csv','fa-square-folder','fa-square-folder-open','fa-square-box','fa-square-package','fa-square-archive','fa-square-compress','fa-square-expand','fa-square-maximize','fa-square-minimize','fa-square-resize','fa-square-arrows','fa-square-arrows-up-down-left-right','fa-square-arrows-left-right','fa-square-arrows-up-down','fa-square-arrows-rotate','fa-square-arrow-rotate-left','fa-square-arrow-rotate-right','fa-square-rotate','fa-square-rotate-left','fa-square-rotate-right','fa-square-flip','fa-square-flip-horizontal','fa-square-flip-vertical','fa-square-flop-horizontal','fa-square-flop-vertical','fa-square-shuffle','fa-square-random','fa-square-repeat','fa-square-repeat-1','fa-square-repeat-1-alt','fa-square-refresh','fa-square-refresh-cw','fa-square-refresh-ccw','fa-square-sync','fa-square-sync-alt','fa-square-spinner','fa-square-spinner-third','fa-square-circle-notch','fa-square-hourglass-half','fa-square-loader','fa-square-cog','fa-square-cogs','fa-square-gear','fa-square-gears','fa-square-wrench','fa-square-screwdriver','fa-square-hammer','fa-square-pliers','fa-square-toolbox','fa-square-tools','fa-square-gauge','fa-square-gauge-high','fa-square-gauge-simple','fa-square-gauge-simple-high','fa-square-tachometer','fa-square-speedometer','fa-square-meter','fa-square-meter-square','fa-square-meter-cube','fa-square-thermometer','fa-square-thermometer-sun','fa-square-thermometer-moon','fa-square-thermometer-half','fa-square-thermometer-empty','fa-square-thermometer-full','fa-square-thermometer-quarters','fa-square-temperature-high','fa-square-temperature-low','fa-square-humidity','fa-square-wind','fa-square-droplets','fa-square-cloud-droplet','fa-square-cloud-rain','fa-square-cloud-snow','fa-square-cloud-lightning','fa-square-cloud-lightning-rain','fa-square-sun','fa-square-moon','fa-square-star','fa-square-heart','fa-square-heart-pulse','fa-square-heart-crack','fa-square-flame','fa-square-fire','fa-square-ice-cream','fa-square-snowflake','fa-square-fog','fa-square-smoke','fa-square-smog','fa-square-dust','fa-square-tornado','fa-square-wind-turbine','fa-square-umbrella','fa-square-umbrella-beach','fa-square-sunglasses','fa-square-glasses','fa-square-mask','fa-square-face-smile','fa-square-face-frown','fa-square-face-meh','fa-square-face-grin','fa-square-face-laugh','fa-square-face-cry','fa-square-face-surprise','fa-square-face-sad-tear','fa-square-face-wink','fa-square-face-kiss','fa-square-face-smile-beam','fa-square-face-smile-plus','fa-square-face-frown-open','fa-square-face-meh-blank','fa-square-face-grin-wide','fa-square-face-grin-beam','fa-square-face-grin-squint','fa-square-face-grin-hearts','fa-square-face-laugh-beam','fa-square-face-laugh-squint','fa-square-face-cry-bounce','fa-square-face-surprise-open','fa-square-face-sad-tear','fa-square-face-wink-beam','fa-square-face-kiss-beam','fa-square-face-kiss-wink-heart','fa-square-face-dizzy','fa-square-face-exhausted','fa-square-face-confused','fa-square-face-triangle-exclamation','fa-square-face-circle-exclamation','fa-square-face-circle-question','fa-square-face-circle-info','fa-square-face-circle-xmark','fa-square-face-circle-check','fa-square-face-angel','fa-square-face-devil','fa-square-face-ghost','fa-square-face-skull','fa-square-face-skull-crossbones','fa-hand-dragon','fa-hand-sparkles','fa-hand-cursor-pointer'],
    brands: ['fa-facebook','fa-facebook-f','fa-messenger','fa-instagram','fa-whatsapp','fa-twitter','fa-x-twitter','fa-tiktok','fa-youtube','fa-youtube-play','fa-youtube-square','fa-vimeo','fa-vimeo-v','fa-dribbble','fa-behance','fa-linkedin','fa-linkedin-in','fa-pinterest','fa-pinterest-p','fa-snapchat','fa-snapchat-ghost','fa-reddit','fa-reddit-alien','fa-tumblr','fa-tumblr-square','fa-flickr','fa-deviantart','fa-500px','fa-github','fa-github-alt','fa-github-square','fa-gitlab','fa-bitbucket','fa-bitbucket-square','fa-stack-overflow','fa-stack-exchange','fa-codeforces','fa-codepen','fa-codesandbox','fa-jsfiddle','fa-repl','fa-repl-it','fa-git','fa-git-alt','fa-git-square','fa-npm','fa-yarn','fa-node','fa-node-js','fa-python','fa-java','fa-js','fa-js-square','fa-react','fa-vuejs','fa-vue','fa-angular','fa-angularjs','fa-bootstrap','fa-sass','fa-css3','fa-css3-alt','fa-html5','fa-xml','fa-xml-square','fa-database','fa-mysql','fa-postgresql','fa-sqlite','fa-mongodb','fa-redis','fa-aws','fa-amazon','fa-amazon-pay','fa-google','fa-google-plus','fa-google-plus-g','fa-google-pay','fa-apple','fa-apple-pay','fa-app-store','fa-app-store-ios','fa-microsoft','fa-windows','fa-linux','fa-android','fa-docker','fa-kubernetes','fa-k8s','fa-helm','fa-minikube','fa-openshift','fa-virtualbox','fa-vmware','fa-ubuntu','fa-debian','fa-centos','fa-fedora','fa-redhat','fa-suse','fa-archlinux','fa-alpine','fa-flutter','fa-dart','fa-swift','fa-kotlin','fa-go','fa-golang','fa-rust','fa-rust-lang','fa-c','fa-c-plus-plus','fa-c-sharp','fa-typescript','fa-ts','fa-assembly','fa-lua','fa-perl','fa-ruby','fa-rails','fa-django','fa-flask','fa-fastapi','fa-express','fa-nestjs','fa-spring','fa-spring-boot','fa-hibernate','fa-mybatis','fa-tensorflow','fa-pytorch','fa-keras','fa-scikit-learn','fa-jupyter','fa-colab','fa-hugging-face','fa-openai','fa-chatgpt','fa-google-ai','fa-microsoft-ai','fa-anthropic','fa-amazon-ai','fa-alibaba','fa-taobao','fa-tmall','fa-jd','fa-pinduoduo','fa-meituan','fa-eleme','fa-didi','fa-wechat','fa-weixin','fa-weibo','fa-qq','fa-qzone','fa-bilibili','fa-douyin','fa-kuaishou','fa-xiaohongshu','fa-zhihu','fa-csdn','fa-oschina','fa-gitee','fa-sogou','fa-baidu','fa-alipay','fa-credit-card','fa-banknote','fa-coins','fa-wallet','fa-money-bill','fa-money-bill-alt','fa-money-bill-wave','fa-money-bill-transfer','fa-money-check','fa-money-check-alt','fa-money-check-dollar','fa-money-check-euro','fa-receipt','fa-receipt-cutoff','fa-file-invoice','fa-file-invoice-dollar','fa-file-invoice-euro','fa-ticket','fa-ticket-alt','fa-ticket-percent','fa-gift-card','fa-gift','fa-heart','fa-star','fa-thumbs-up','fa-thumbs-down','fa-share','fa-share-alt','fa-share-square','fa-copy','fa-paste','fa-cut','fa-clipboard','fa-clipboard-list','fa-clipboard-check','fa-paperclip','fa-link','fa-external-link','fa-external-link-alt','fa-external-link-square','fa-phone','fa-phone-alt','fa-phone-volume','fa-mobile','fa-mobile-screen-button','fa-tablet','fa-tablet-screen-button','fa-laptop','fa-laptop-code','fa-desktop','fa-monitor','fa-tv','fa-radio','fa-cd','fa-dvd','fa-disc','fa-floppy-disk','fa-hard-drive','fa-memory-stick','fa-usb','fa-printer','fa-scanner','fa-projector','fa-headphones','fa-headphones-alt','fa-headset','fa-microphone','fa-microphone-alt','fa-microphone-slash','fa-volume-up','fa-volume-down','fa-volume-off','fa-volume-x','fa-music','fa-play','fa-pause','fa-stop','fa-forward','fa-backward','fa-fast-forward','fa-fast-backward','fa-step-forward','fa-step-backward','fa-eject','fa-repeat','fa-repeat-1','fa-repeat-1-alt','fa-shuffle','fa-random','fa-list','fa-list-ul','fa-list-ol','fa-list-check','fa-list-todo','fa-list-alt','fa-list-square','fa-align-left','fa-align-center','fa-align-right','fa-align-justify','fa-indent','fa-outdent','fa-text-height','fa-text-width','fa-font','fa-font-awesome','fa-font-awesome-alt','fa-font-awesome-logo-full','fa-font-awesome-brands','fa-font-awesome-solid','fa-font-awesome-regular','fa-font-awesome-v4','fa-font-awesome-v4-font-awesome','fa-font-awesome-v4-icon','fa-font-awesome-v4-logo','fa-font-awesome-v4-square','fa-font-awesome-v4-brands','fa-font-awesome-v4-solid','fa-font-awesome-v4-regular','fa-font-awesome-v4-o']
  };

  function initIconSelector(inputId) {
    var input = $('#' + inputId);
    if (!input) return;
    
    var wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';
    wrapper.style.alignItems = 'center';
    
    var iconPreview = document.createElement('span');
    iconPreview.style.width = '28px';
    iconPreview.style.height = '28px';
    iconPreview.style.display = 'flex';
    iconPreview.style.alignItems = 'center';
    iconPreview.style.justifyContent = 'center';
    iconPreview.style.fontSize = '20px';
    iconPreview.style.cursor = 'pointer';
    iconPreview.style.padding = '4px';
    iconPreview.style.borderRadius = 'var(--radius-sm)';
    iconPreview.style.transition = 'var(--transition)';
    iconPreview.addEventListener('mouseover', function() { this.style.background = 'var(--primary-light)'; });
    iconPreview.addEventListener('mouseout', function() { this.style.background = 'transparent'; });
    
    updateIconPreview(iconPreview, input.value);
    
    input.parentElement.replaceChild(wrapper, input);
    wrapper.appendChild(iconPreview);
    wrapper.appendChild(input);
    
    input.style.flex = '1';
    
    input.addEventListener('change', function() {
      updateIconPreview(iconPreview, this.value);
    });
    
    var pickerId = inputId + 'Picker';
    
    iconPreview.addEventListener('click', function(e) {
      e.stopPropagation();
      var existingPicker = $('#' + pickerId);
      if (existingPicker) {
        existingPicker.remove();
        return;
      }
      
      var picker = document.createElement('div');
      picker.id = pickerId;
      picker.style.position = 'absolute';
      picker.style.top = '100%';
      picker.style.left = '0';
      picker.style.marginTop = '4px';
      picker.style.width = '320px';
      picker.style.maxHeight = '400px';
      picker.style.overflow = 'auto';
      picker.style.background = 'var(--bg-color)';
      picker.style.border = '1px solid var(--border-color)';
      picker.style.borderRadius = 'var(--radius-md)';
      picker.style.boxShadow = 'var(--shadow-lg)';
      picker.style.zIndex = '1000';
      picker.style.padding = '8px';
      
      var typeButtons = '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
        '<button class="btn btn-sm btn-primary" data-type="solid">Solid</button>' +
        '<button class="btn btn-sm" data-type="regular">Regular</button>' +
        '<button class="btn btn-sm" data-type="brands">Brands</button>' +
        '<button class="btn btn-sm" data-type="custom">自定义</button>' +
        '</div>';
      picker.innerHTML = typeButtons + 
        '<div id="' + pickerId + 'Grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;"></div>' +
        '<div id="' + pickerId + 'Upload" style="display:none;padding:12px;text-align:center;border-top:1px solid var(--border-color);margin-top:8px;">' +
        '<div style="margin-bottom:8px;">上传自定义图标</div>' +
        '<input type="file" id="' + pickerId + 'File" accept="image/*" style="display:none;">' +
        '<button class="btn btn-sm btn-primary" id="' + pickerId + 'UploadBtn"><i class="fa-solid fa-upload"></i> 选择图片</button>' +
        '<div style="margin-top:12px;font-size:12px;color:var(--text-muted);">支持 PNG, JPG, SVG, WebP, GIF (最大2MB)</div>' +
        '<div id="' + pickerId + 'CustomIcons" style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:12px;"></div>' +
        '</div>';
      
      wrapper.style.position = 'relative';
      wrapper.appendChild(picker);
      
      var currentType = 'solid';
      
      function renderPickerIcons() {
        $('#' + pickerId + 'Grid').style.display = currentType !== 'custom' ? 'grid' : 'none';
        $('#' + pickerId + 'Upload').style.display = currentType === 'custom' ? 'block' : 'none';
        
        if (currentType === 'custom') {
          loadCustomIcons(pickerId);
          return;
        }
        
        var list = iconData[currentType] || [];
        var prefix = currentType === 'solid' ? 'fa-solid' : currentType === 'regular' ? 'fa-regular' : 'fa-brands';
        $('#' + pickerId + 'Grid').innerHTML = list.map(function(n) {
          return '<div style="text-align:center;padding:4px;cursor:pointer;border-radius:4px;" data-prefix="' + prefix + '" data-icon="' + n + '">' +
            '<i class="' + prefix + ' ' + n + '" style="font-size:16px;"></i></div>';
        }).join('');
        $$('#' + pickerId + 'Grid > div').forEach(function(el) {
          el.addEventListener('click', function() {
            var className = el.dataset.prefix + ' ' + el.dataset.icon;
            input.value = className;
            updateIconPreview(iconPreview, className);
            picker.remove();
          });
        });
      }
      
      $$('#' + pickerId + ' .btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          $$('#' + pickerId + ' .btn').forEach(function(b) { b.classList.remove('btn-primary'); });
          this.classList.add('btn-primary');
          currentType = this.dataset.type;
          renderPickerIcons();
        });
      });
      
      $('#' + pickerId + 'UploadBtn').addEventListener('click', function() {
        $('#' + pickerId + 'File').click();
      });
      
      $('#' + pickerId + 'File').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var formData = new FormData();
        formData.append('file', file);
        
        apiFetch('/icons/upload', {
          method: 'POST',
          body: formData
        }).then(function(res) {
          input.value = res.url;
          updateIconPreview(iconPreview, res.url);
          toast('图标上传成功', 'success');
          picker.remove();
        }).catch(function(err) {
          toast('上传失败: ' + err.message, 'error');
        });
      });
      
      renderPickerIcons();
      
      document.addEventListener('click', function closePicker(e) {
        if (!picker.contains(e.target) && !iconPreview.contains(e.target)) {
          picker.remove();
          document.removeEventListener('click', closePicker);
        }
      });
    });
  }
  
  function updateIconPreview(preview, value) {
    if (!value || value === 'fa-solid fa-gear') {
      preview.innerHTML = '<i class="fa-solid fa-gear"></i>';
      return;
    }
    
    if (value.startsWith('/icons/') || value.startsWith('http')) {
      preview.innerHTML = '<img src="' + value + '" style="width:24px;height:24px;border-radius:4px;object-fit:contain;">';
    } else {
      preview.innerHTML = '<i class="' + value + '"></i>';
    }
  }
  
  function loadCustomIcons(pickerId) {
    apiFetch('/icons/list').then(function(icons) {
      var container = $('#' + pickerId + 'CustomIcons');
      if (icons && icons.length > 0) {
        container.innerHTML = icons.map(function(icon) {
          return '<div style="text-align:center;padding:4px;cursor:pointer;border-radius:4px;" data-url="' + icon.url + '">' +
            '<img src="' + icon.url + '" style="width:24px;height:24px;border-radius:4px;object-fit:contain;">' +
            '</div>';
        }).join('');
        
        $$('#' + pickerId + 'CustomIcons > div').forEach(function(el) {
          el.addEventListener('click', function() {
            var url = el.dataset.url;
            var input = $('#' + pickerId.replace('Picker', ''));
            if (input) {
              input.value = url;
              var wrapper = input.parentElement;
              var iconPreview = wrapper.querySelector('span');
              if (iconPreview) {
                updateIconPreview(iconPreview, url);
              }
              $('#' + pickerId).remove();
            }
          });
        });
      } else {
        container.innerHTML = '<div style="grid-column:1/-1;color:var(--text-muted);font-size:12px;">暂无自定义图标</div>';
      }
    }).catch(function() {
      $('#' + pickerId + 'CustomIcons').innerHTML = '<div style="grid-column:1/-1;color:var(--text-muted);font-size:12px;">加载失败</div>';
    });
  }

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function toast(msg, type) {
    type = type || 'info';
    var container = $('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
  }

  function apiFetch(path, options) {
    options = options || {};
    if (!options.headers) options.headers = {};
    if (appState.authToken) {
      options.headers['Authorization'] = 'Bearer ' + appState.authToken;
    }
    var isFormData = options.body instanceof FormData;
    if (!options.headers['Content-Type'] && options.method && options.method !== 'GET' && !isFormData) {
      options.headers['Content-Type'] = 'application/json';
    }
    return fetch(API_BASE + path, options).then(function(res) {
      if (res.status === 401) {
        appState.authToken = null;
        appState.currentUser = null;
        _currentRenderRoute = null;
        localStorage.removeItem('tcp_token');
        localStorage.removeItem('tcp_user');
        invalidateDataCache();
        updateTopbarUser();
        // GET请求遇到401自动切换到访客模式浏览公开页面，不跳转登录
        if (!options.method || options.method === 'GET') {
          var currentRoute = getRoute();
          if (currentRoute !== 'urls' && currentRoute !== 'login') {
            window.location.hash = 'urls';
          }
          loadPublicData().then(function() {
            renderRoute(getRoute());
          });
        } else {
          // 写操作401跳登录
          window.location.href = '/login.html';
        }
        throw new Error('Authentication required');
      }
      if (!res.ok) {
        return res.json().catch(function() { return { detail: 'Request failed' }; }).then(function(err) {
          throw new Error(err.detail || 'Request failed');
        });
      }
      // 写操作成功后让数据缓存失效，确保下次渲染拿到最新数据；
      // /history（访问记录，高频且不改变列表）/ /favorites/toggle（已在调用处就地更新）除外，
      // 否则每次点击都会触发全量重拉，抵消缓存带来的即时响应
      if (options.method && options.method !== 'GET' &&
          path !== '/history' && path !== '/favorites/toggle') {
        invalidateDataCache();
      }
      return res.json();
    });
  }

  function loadTheme() {
    var saved = localStorage.getItem('tcp_theme');
    appState.theme = saved || 'light';
    var savedColor = localStorage.getItem('tcp_primaryColor');
    appState.primaryColor = savedColor || '#4f46e5';
    applyTheme();
  }

  function applyTheme() {
    if (appState.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    document.documentElement.style.setProperty('--primary-color', appState.primaryColor);
    document.documentElement.style.setProperty('--primary-hover', adjustColor(appState.primaryColor, -20));
    document.documentElement.style.setProperty('--primary-light', appState.primaryColor + '1a');
    var themeBtn = $('#themeToggle i');
    if (themeBtn) {
      themeBtn.className = appState.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  function adjustColor(hex, amount) {
    var r, g, b;
    if (hex.length === 7) {
      r = parseInt(hex.slice(1,3), 16);
      g = parseInt(hex.slice(3,5), 16);
      b = parseInt(hex.slice(5,7), 16);
    } else {
      return hex;
    }
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    return '#' + [r,g,b].map(function(v) { return v.toString(16).padStart(2,'0'); }).join('');
  }

  function setTheme(theme) {
    appState.theme = theme;
    localStorage.setItem('tcp_theme', theme);
    applyTheme();
    apiFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme })
    }).catch(function() {});
  }

  function setPrimaryColor(color) {
    appState.primaryColor = color;
    localStorage.setItem('tcp_primaryColor', color);
    applyTheme();
    apiFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryColor: color })
    }).catch(function() {});
  }

  function loadLocalSettings() {
    var v = localStorage.getItem('tcp_toolView');
    appState.toolView = v || 'grid';
    var hideOffline = localStorage.getItem('tcp_hideOfflineEnvs');
    appState.hideOfflineEnvs = hideOffline === 'true';
  }

  function saveLocalSetting(key, value) {
    localStorage.setItem('tcp_' + key, value);
  }

  function loadAuthState() {
    var token = localStorage.getItem('tcp_token');
    var userStr = localStorage.getItem('tcp_user');
    
    function startApp(isLoggedIn) {
      updateTopbarUser();
      // 立即渲染当前路由，不等待数据加载
      renderRoute(getRoute());
      
      if (isLoggedIn) {
        // 异步验证token并加载全量数据
        apiFetch('/auth/me').then(function(user) {
          appState.currentUser = user;
          localStorage.setItem('tcp_user', JSON.stringify(user));
          updateTopbarUser();
          loadAllData().then(function() {
            renderRoute(getRoute());
          });
        }).catch(function() {
          appState.authToken = null;
          appState.currentUser = null;
          localStorage.removeItem('tcp_token');
          localStorage.removeItem('tcp_user');
          updateTopbarUser();
          loadPublicData().then(function() {
            renderRoute(getRoute());
          });
        });
      } else {
        loadPublicData().then(function() {
          renderRoute(getRoute());
        });
      }
    }
    
    if (token && userStr) {
      try {
        appState.authToken = token;
        appState.currentUser = JSON.parse(userStr);
        startApp(true);
      } catch(e) {
        appState.authToken = null;
        appState.currentUser = null;
        startApp(false);
      }
    } else {
      appState.authToken = null;
      appState.currentUser = null;
      startApp(false);
    }
  }

  function updateTopbarUser() {
    var themeToggle = $('#themeToggle');
    if (themeToggle) {
      themeToggle.style.display = appState.currentUser ? '' : 'none';
    }
    var el = $('#topbarUser');
    if (el) {
      if (appState.currentUser) {
        var roleLabel = appState.currentUser.role === 'superadmin' ? '超级管理员' : '普通用户';
        el.innerHTML = '<i class="fa-solid fa-user"></i> ' + escHtml(getUserDisplayName(appState.currentUser)) + ' (' + roleLabel + ')' +
          '<button class="topbar-btn" id="logoutBtn" title="退出登录" style="margin-left:8px;"><i class="fa-solid fa-right-from-bracket"></i></button>';
        var logoutBtn = $('#logoutBtn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function() {
            // 立即清除本地状态，立即切换到访客模式，不等待API响应
            appState.authToken = null;
            appState.currentUser = null;
            _currentRenderRoute = null;
            localStorage.removeItem('tcp_token');
            localStorage.removeItem('tcp_user');
            // 立即更新顶栏和侧边栏
            updateTopbarUser();
            invalidateDataCache();
            // 立即跳转到公开页面并渲染
            if (window.location.hash !== '#urls') {
              window.location.hash = 'urls';
            } else {
              renderRoute('urls');
            }
            // 后台异步加载公开数据
            loadPublicData().then(function() {
              renderRoute('urls');
            });
            // 异步通知后端登出，完全不阻塞UI
            apiFetch('/auth/logout', { method: 'POST' }).catch(function() {});
          });
        }
      } else {
        el.innerHTML = '<a href="/login.html" style="color:var(--primary-color);text-decoration:none;font-size:14px;"><i class="fa-solid fa-right-to-bracket"></i> 登录</a>';
      }
    }
    renderSidebar();
    // T2.1：登录态变化时同步告警铃铛徽章
    if (window.ToolchainApp && ToolchainApp.refreshAlertBadge) ToolchainApp.refreshAlertBadge();
  }

  function hasPermission(action) {
    if (!appState.currentUser) return false;
    if (appState.currentUser.role === 'superadmin') return true;
    return (appState.currentUser.permissions || []).indexOf(action) !== -1;
  }

  function initWebSocket() {
    var ws;
    function connect() {
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = function() {
          appState.wsConnected = true;
          updateConnectionIndicator();
        };
        ws.onmessage = function(event) {
          try {
            var statuses = JSON.parse(event.data);
            statuses.forEach(function(s) {
              appState.envStatuses[s.id] = s.status;
            });
            updateStatusIndicators();
            // T2.1：状态变化可能产生新告警，刷新铃铛徽章
            if (window.ToolchainApp && ToolchainApp.refreshAlertBadge) ToolchainApp.refreshAlertBadge();
          } catch (e) {}
        };
        ws.onclose = function() {
          appState.wsConnected = false;
          updateConnectionIndicator();
          setTimeout(connect, 5000);
        };
        ws.onerror = function() {
          ws.close();
        };
      } catch (e) {
        setTimeout(connect, 5000);
      }
    }
    connect();
  }

  function updateConnectionIndicator() {
    var el = $('#wsStatus');
    if (el) {
      el.className = 'connection-dot ' + (appState.wsConnected ? 'connected' : 'disconnected');
    }
  }

  function getStatusText(s) {
    return s === 'online' ? '在线' : s === 'offline' ? '离线' : '检测中';
  }

  function refreshAllStatuses() {
    apiFetch('/status').then(function(statusData) {
      if (statusData.env_statuses) {
        statusData.env_statuses.forEach(function(s) {
          appState.envStatuses[s.id] = s.status;
        });
        updateStatusIndicators();
      }
    }).catch(function() {});
  }

  function applyOfflineVisibility() {
    var contentEl = $('#urlsContent');
    if (!contentEl) return;
    
    if (appState.hideOfflineEnvs && appState.currentUser) {
      contentEl.classList.add('hide-offline-envs');
    } else {
      contentEl.classList.remove('hide-offline-envs');
    }

    $$('.card[data-env-id]').forEach(function(card) {
      var envId = parseInt(card.dataset.envId);
      var st = envId ? appState.envStatuses[envId] : 'unknown';
      if (st === 'offline') {
        card.classList.add('offline-env-card');
      } else {
        card.classList.remove('offline-env-card');
      }
    });

    requestAnimationFrame(function() {
      $$('.mine-group-section').forEach(function(section) {
        var hasVisibleCards = false;
        section.querySelectorAll('.card[data-env-id]').forEach(function(card) {
          var envId = parseInt(card.dataset.envId);
          var st = envId ? appState.envStatuses[envId] : 'unknown';
          if (st !== 'offline' || !appState.hideOfflineEnvs || !appState.currentUser) {
            hasVisibleCards = true;
          }
        });
        section.classList.toggle('mine-group-empty', !hasVisibleCards);
      });
      $$('.env-group-section').forEach(function(group) {
        var hasVisibleContent = false;
        group.querySelectorAll('.card[data-env-id]').forEach(function(card) {
          var envId = parseInt(card.dataset.envId);
          var st = envId ? appState.envStatuses[envId] : 'unknown';
          if (st !== 'offline' || !appState.hideOfflineEnvs || !appState.currentUser) {
            hasVisibleContent = true;
          }
        });
        if (!hasVisibleContent) {
          group.querySelectorAll('.mine-group-section').forEach(function(mg) {
            if (!mg.classList.contains('mine-group-empty')) {
              hasVisibleContent = true;
            }
          });
        }
        group.classList.toggle('env-group-empty', !hasVisibleContent);
      });
    });
  }

  function updateStatusIndicators() {
    $$('.status-dot').forEach(function(dot) {
      var id = parseInt(dot.dataset.envId);
      if (id && appState.envStatuses[id]) {
        dot.className = 'status-dot ' + appState.envStatuses[id];
      }
    });
    $$('.status-indicator .dot').forEach(function(dot) {
      var id = parseInt(dot.dataset.envId);
      if (id && appState.envStatuses[id]) {
        dot.className = 'dot ' + appState.envStatuses[id];
      }
    });
    function setTextFor(selector, textKey) {
      $$(selector).forEach(function(el) {
        var dot = el.querySelector('.dot, .status-dot');
        var textSpan = el.querySelector(textKey);
        if (!textSpan) {
          textSpan = document.createElement('span');
          textSpan.className = textKey.replace('.', '');
          el.appendChild(textSpan);
        }
        var id = dot ? parseInt(dot.dataset.envId) : null;
        if (id && appState.envStatuses[id]) {
          textSpan.textContent = getStatusText(appState.envStatuses[id]);
        }
      });
    }
    setTextFor('.status-indicator', '.status-text');
    setTextFor('.env-status-item', '.env-status-text');
    setTextFor('.card-meta-simple', '.status-text-simple');
    $$('.open-env-btn, .btn-disabled[data-env-id]').forEach(function(btn) {
      var id = parseInt(btn.dataset.envId);
      if (id && appState.envStatuses[id]) {
        var st = appState.envStatuses[id];
        var icon = '<i class="fa-solid fa-arrow-up-right-from-square"></i> ';
        if (st === 'offline') {
          btn.className = 'btn btn-sm btn-disabled';
          btn.disabled = true;
          btn.title = '无法连接';
          btn.innerHTML = icon + '无法连接';
        } else {
          btn.className = 'btn btn-sm btn-primary open-env-btn';
          btn.disabled = false;
          btn.removeAttribute('title');
          btn.innerHTML = icon + '打开';
        }
      }
    });
    $$('.env-sublink').forEach(function(link) {
      var card = link.closest('.card');
      if (card) {
        var btn = card.querySelector('.open-env-btn, .btn-disabled[data-env-id]');
        if (btn) {
          var envId = parseInt(btn.dataset.envId);
          if (envId && appState.envStatuses[envId] === 'offline') {
            link.classList.add('sublink-disabled');
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.5';
            link.style.cursor = 'not-allowed';
            link.title = '无法连接';
            link.removeAttribute('href');
          } else if (envId && appState.envStatuses[envId] === 'online') {
            link.classList.remove('sublink-disabled');
            link.style.pointerEvents = '';
            link.style.opacity = '';
            link.style.cursor = '';
            link.title = link.dataset.name || '';
            if (!link.getAttribute('href') && link.dataset.originalHref) {
              link.href = link.dataset.originalHref;
              link.setAttribute('target', '_blank');
            }
          }
        }
      }
    });

    $$('.card[data-env-id]').forEach(function(card) {
      var envId = parseInt(card.dataset.envId);
      var st = envId ? appState.envStatuses[envId] : 'unknown';
      if (st === 'offline') {
        card.classList.add('offline-env-card');
      } else {
        card.classList.remove('offline-env-card');
      }
    });

    var onlineCount = Object.values(appState.envStatuses).filter(function(s) { return s === 'online'; }).length;
    var onlineEl = $('#onlineCount');
    if (onlineEl) onlineEl.textContent = onlineCount;
    applyOfflineVisibility();
  }

  function formatDate(isoStr) {
    try {
      var d = new Date(isoStr);
      var now = new Date();
      var diff = now - d;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
      var month = (d.getMonth()+1).toString().padStart(2,'0');
      var day = d.getDate().toString().padStart(2,'0');
      var hour = d.getHours().toString().padStart(2,'0');
      var min = d.getMinutes().toString().padStart(2,'0');
      return month + '-' + day + ' ' + hour + ':' + min;
    } catch(e) {
      return isoStr;
    }
  }

  function getNowString() {
    var d = new Date();
    var weekdays = ['日','一','二','三','四','五','六'];
    var y = d.getFullYear();
    var m = (d.getMonth()+1).toString().padStart(2,'0');
    var day = d.getDate().toString().padStart(2,'0');
    var w = weekdays[d.getDay()];
    var h = d.getHours().toString().padStart(2,'0');
    var min = d.getMinutes().toString().padStart(2,'0');
    var s = d.getSeconds().toString().padStart(2,'0');
    return y + '年' + m + '月' + day + '日 星期' + w + ' ' + h + ':' + min + ':' + s;
  }

  function navigateTo(route) {
    if (window.location.hash === '#' + route) {
      renderRoute(route);
    } else {
      window.location.hash = route;
    }
  }

  function getRoute() {
    return window.location.hash.replace('#', '') || 'home';
  }

  function hasPageAccess(page) {
    if (!appState.currentUser) return false;
    if (appState.currentUser.role === 'superadmin') return true;
    if (ADMIN_PAGES.indexOf(page) !== -1) return false;
    if (page === 'service-detail') {
      var pages = appState.currentUser.pages || DEFAULT_USER_PAGES;
      return pages.indexOf('services') !== -1;
    }
    var pages = appState.currentUser.pages || DEFAULT_USER_PAGES;
    return pages.indexOf(page) !== -1;
  }

  function renderSidebar() {
    var sidebar = $('#sidebar');
    if (!sidebar) return;
    if (!appState.currentUser) {
      sidebar.style.display = 'none';
      sidebar.innerHTML = '';
      return;
    }
    sidebar.style.display = '';
    var order = (appState.data.menuOrder && appState.data.menuOrder.length > 0) ? appState.data.menuOrder.slice() : DEFAULT_MENU_ORDER.slice();
    // 兼容旧 menuOrder：若登录用户能访问 services/alerts/recycle/api 但 menuOrder 中缺失，自动插入到合适位置
    var insertPages = [
      { page: 'services', after: 'urls' },
      { page: 'alerts', after: 'favorites' },
      { page: 'recycle', after: 'alerts' },
      { page: 'api', after: 'recycle' }
    ];
    insertPages.forEach(function(item) {
      if (order.indexOf(item.page) === -1 && hasPageAccess(item.page)) {
        var afterIdx = order.indexOf(item.after);
        if (afterIdx !== -1) { order.splice(afterIdx + 1, 0, item.page); } else { order.push(item.page); }
      }
    });
    var html = '';
    order.forEach(function(route) {
      if (!PAGE_CONFIG[route]) return;
      if (!hasPageAccess(route)) return;
      var cfg = PAGE_CONFIG[route];
      var active = getRoute() === route ? ' active' : '';
      html += '<a href="#' + route + '" class="nav-item' + active + '" data-route="' + route + '">' +
        '<i class="fa-solid ' + cfg.icon + '"></i><span>' + cfg.name + '</span></a>';
    });
    sidebar.innerHTML = html;
    // 即时点击反馈：mousedown立即高亮，不等待hashchange
    sidebar.querySelectorAll('.nav-item').forEach(function(item) {
      item.addEventListener('mousedown', function() {
        sidebar.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  }

  var _currentRenderRoute = null;
  
  function renderRoute(route) {
    var content = $('#content');
    // 未登录：仅允许访问 urls 与 login；访问其他页面时回退到 urls，不再强制跳登录
    if (!appState.currentUser && route !== 'login' && route !== 'urls') {
      route = 'urls';
      window.location.hash = 'urls';
    }
    if (appState.currentUser && !hasPageAccess(route)) {
      route = 'home';
    }
    
    // 避免同一路由重复渲染
    if (_currentRenderRoute === route && content.dataset.page === route) {
      return;
    }
    _currentRenderRoute = route;
    
    renderSidebar();
    var navItems = $$('.nav-item');
    navItems.forEach(function(item) {
      item.classList.remove('active');
      if (item.dataset.route === route) {
        item.classList.add('active');
      }
    });
    content.dataset.page = route;

    // 直接同步渲染页面，使用现有数据立即显示（不等待API）
    // 所有页面函数内部会异步加载数据后自动更新
    switch (route) {
      case 'home': renderHome(content); break;
      case 'urls': renderUrls(content); break;
      case 'tools': renderTools(content); break;
      case 'toolbox': renderToolbox(content); break;
      case 'programs': renderPrograms(content); break;
      case 'favorites': renderFavorites(content); break;
      case 'alerts': if (window.ToolchainApp && ToolchainApp.renderAlerts) { ToolchainApp.renderAlerts(content); } else { content.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">告警中心加载中…</p>'; } break;
      case 'recycle': if (window.ToolchainApp && ToolchainApp.renderRecycleRequests) { ToolchainApp.renderRecycleRequests(content); } else { content.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">资源回收加载中…</p>'; } break;
      case 'services': if (window.ToolchainApp && ToolchainApp.renderServices) { ToolchainApp.renderServices(content); } else { content.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">服务目录加载中…</p>'; } break;
      case 'service-detail': if (window.ToolchainApp && ToolchainApp.renderServiceDetail) { ToolchainApp.renderServiceDetail(content); } else { content.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">服务详情加载中…</p>'; } break;
      case 'settings': renderSettings(content); break;
      case 'login': renderLogin(content); break;
      case 'users': renderUsers(content); break;
      case 'api': renderApiManagement(content); break;
      default: renderPrograms(content);
    }
  }

  // 数据缓存窗口：TTL 内复用已加载数据，点击导航即时响应；过期或被写操作失效后重新拉取
  // 延长缓存时间到2分钟，大幅减少重复API请求
  var DATA_CACHE_TTL = 120000;

  // 让数据缓存失效（写操作成功后调用），下次渲染会重新拉取最新数据
  function invalidateDataCache() {
    appState.dataLoaded = false;
  }

  // 已登录用户加载全量数据（带缓存）
  function loadAllData(opts) {
    opts = opts || {};
    var force = opts.force;
    // 去重：已有请求在飞，复用同一 Promise，避免并发导航重复请求
    if (appState.dataLoadPromise) return appState.dataLoadPromise;
    // 命中缓存：数据已加载且未过期，立即返回，渲染直接用已有数据（点击即时响应）
    if (!force && appState.dataLoaded && appState.dataLoadMode === 'all' &&
        (Date.now() - appState.dataLoadTime) < DATA_CACHE_TTL) {
      return Promise.resolve();
    }
    appState.dataLoadPromise = fetchAllData().then(function() {
      appState.dataLoaded = true;
      appState.dataLoadMode = 'all';
      appState.dataLoadTime = Date.now();
    }).catch(function(e) {
      console.error('Data load error:', e);
    }).then(function() {
      appState.dataLoadPromise = null;
    });
    return appState.dataLoadPromise;
  }

  function fetchAllData() {
    function safeFetch(path, fallback) {
      return apiFetch(path).catch(function() { return fallback; });
    }
    var promises = [
      apiFetch('/envs'),
      apiFetch('/tools'),
      apiFetch('/categories'),
      apiFetch('/favorites'),
      apiFetch('/history'),
      apiFetch('/settings'),
      safeFetch('/quick-entries', []),
      safeFetch('/env-groups', []),
      safeFetch('/toolbox-groups', []),
      safeFetch('/mine-groups', []),
      apiFetch('/menu-order'),
      safeFetch('/programs', []),
      safeFetch('/program-categories', ['脚本', '服务', '配置', '工具']),
      safeFetch('/tool-groups', []),
      safeFetch('/tool-tags', [])
    ];
    return Promise.all(promises).then(function(results) {
      appState.data.envs = results[0];
      appState.data.tools = results[1];
      appState.data.categories = results[2];
      appState.data.favorites = results[3] || { envs: [], tools: [], toolbox: [] };
      if (!appState.data.favorites.envs) appState.data.favorites.envs = [];
      if (!appState.data.favorites.tools) appState.data.favorites.tools = [];
      if (!appState.data.favorites.toolbox) appState.data.favorites.toolbox = [];
      appState.data.history = results[4];
      appState.data.settings = results[5];
      appState.data.quickEntries = results[6] || [];
      appState.data.envGroups = results[7] || [];
      appState.data.toolboxGroups = results[8] || [];
      appState.data.mineGroups = results[9] || [];
      appState.data.menuOrder = results[10] || DEFAULT_MENU_ORDER;
      appState.data.scripts = [];
      appState.data.programs = results[11] || [];
      appState.data.programCategories = results[12] || ['脚本', '服务', '配置', '工具'];
      appState.data.toolCompanyGroups = results[13] || [];
      appState.data.toolTags = results[14] || [];
      appState.data.envs.forEach(function(env) {
        if (!appState.envStatuses[env.id]) {
          appState.envStatuses[env.id] = 'unknown';
        }
      });
    });
  }

  // 未登录访客仅加载网址大全所需的公开数据，避免触发 401（带缓存）
  function loadPublicData(opts) {
    opts = opts || {};
    var force = opts.force;
    if (appState.dataLoadPromise) return appState.dataLoadPromise;
    if (!force && appState.dataLoaded && appState.dataLoadMode === 'public' &&
        (Date.now() - appState.dataLoadTime) < DATA_CACHE_TTL) {
      return Promise.resolve();
    }
    appState.dataLoadPromise = fetchPublicData().then(function() {
      appState.dataLoaded = true;
      appState.dataLoadMode = 'public';
      appState.dataLoadTime = Date.now();
    }).catch(function(e) {
      console.error('Public data load error:', e);
    }).then(function() {
      appState.dataLoadPromise = null;
    });
    return appState.dataLoadPromise;
  }

  function fetchPublicData() {
    function safeFetch(path, fallback) {
      return apiFetch(path).catch(function() { return fallback; });
    }
    var promises = [
      safeFetch('/envs', []),
      safeFetch('/categories', {}),
      safeFetch('/settings', {}),
      safeFetch('/env-groups', []),
      safeFetch('/mine-groups', []),
      safeFetch('/menu-order', DEFAULT_MENU_ORDER)
    ];
    return Promise.all(promises).then(function(results) {
      appState.data.envs = results[0] || [];
      appState.data.categories = results[1] || {};
      appState.data.settings = results[2] || {};
      appState.data.envGroups = results[3] || [];
      appState.data.mineGroups = results[4] || [];
      appState.data.menuOrder = results[5] || DEFAULT_MENU_ORDER;
      // 访客无收藏/历史/工具等，置空避免渲染残留
      appState.data.favorites = { envs: [], tools: [], toolbox: [] };
      appState.data.history = [];
      appState.data.tools = [];
      appState.data.quickEntries = [];
      appState.data.toolboxGroups = [];
      appState.data.programs = [];
      appState.data.programCategories = ['脚本', '服务', '配置', '工具'];
      appState.data.envs.forEach(function(env) {
        if (!appState.envStatuses[env.id]) {
          appState.envStatuses[env.id] = 'unknown';
        }
      });
    });
  }

  var _homeClockInterval = null;

  function renderHomeContent(content, d) {
    var onlineCount = Object.values(appState.envStatuses).filter(function(s) { return s === 'online'; }).length;
    var favCount = (d.favorites.envs ? d.favorites.envs.length : 0) + 
                   (d.favorites.tools ? d.favorites.tools.length : 0) + 
                   (d.favorites.toolbox ? d.favorites.toolbox.length : 0) + 
                   (d.quickEntries ? d.quickEntries.length : 0);

    content.innerHTML = '<div class="welcome-section"><h2>你好，' + escHtml(getUserDisplayName(appState.currentUser)) + ' 👋</h2><div class="welcome-date" id="liveClock">' + getNowString() + '</div></div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon envs"><i class="fa-solid fa-earth-asia"></i></div><div class="stat-info"><div class="stat-value">' + d.envs.length + '</div><div class="stat-label">环境总数</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon online"><i class="fa-solid fa-wifi"></i></div><div class="stat-info"><div class="stat-value" id="onlineCount">' + onlineCount + '</div><div class="stat-label">在线环境数</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon tools"><i class="fa-solid fa-screwdriver-wrench"></i></div><div class="stat-info"><div class="stat-value">' + d.tools.length + '</div><div class="stat-label">工具总数</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon favs"><i class="fa-solid fa-star"></i></div><div class="stat-info"><div class="stat-value">' + favCount + '</div><div class="stat-label">收藏总数</div></div></div>' +
      '</div>' +
      '<div class="dashboard-grid">' +
        '<div class="dashboard-section">' +
          '<h3><i class="fa-solid fa-signal"></i> 环境状态总览</h3>' +
          '<div class="env-status-list">' +
            d.envs.map(function(env) {
              var s = appState.envStatuses[env.id] || 'unknown';
              var host = (env.accessType === 'domain' && env.domain) ? env.domain : env.ip;
              return '<a class="env-status-item" href="#urls"><span class="status-dot ' + s + '" data-env-id="' + env.id + '"></span><span class="env-name">' + escHtml(env.name) + '</span><span class="env-status-text">' + getStatusText(s) + '</span><span class="env-ip">' + escHtml(host) + '</span></a>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="dashboard-section">' +
          '<h3><i class="fa-solid fa-clock-rotate-left"></i> 最近访问记录</h3>' +
          '<div class="history-list">' +
            (function() {
              var recent = d.history.slice(0, 6);
              if (recent.length === 0) return '<div class="empty-state"><p>暂无记录</p></div>';
              return recent.map(function(h) {
                var icon, name;
                if (h.type === 'env') {
                  icon = '<i class="fa-solid fa-earth-asia"></i>';
                  var env = d.envs.find(function(e) { return e.id === h.id; });
                  name = env ? env.name : '未知环境';
                } else {
                  icon = '<i class="fa-solid fa-screwdriver-wrench"></i>';
                  var tool = d.tools.find(function(t) { return t.id === h.id; });
                  name = tool ? tool.name : '未知工具';
                }
                return '<a class="history-item" data-type="' + h.type + '" data-id="' + h.id + '"><span class="hi-icon">' + icon + '</span>' + escHtml(name) + '<span class="hi-time">' + formatDate(h.time) + '</span></a>';
              }).join('');
            })() +
          '</div>' +
        '</div>' +
        '<div class="dashboard-section">' +
          '<h3><i class="fa-solid fa-star"></i> 我的收藏</h3>' +
          '<div class="quick-entry-list" id="homeQuickEntries">' +
            (function() {
              var favEnvs = d.envs.filter(function(e) { return d.favorites.envs && d.favorites.envs.indexOf(e.id) !== -1; });
              var favTools = d.tools.filter(function(t) { return d.favorites.tools && d.favorites.tools.indexOf(t.id) !== -1; });
              var favToolboxIds = d.favorites.toolbox || [];
              var favToolbox = allToolboxTools.filter(function(t) { return favToolboxIds.indexOf(t.id) !== -1; });
              var quickEntries = d.quickEntries || [];
              var allEntries = favEnvs.map(function(e) { return { type: 'env', id: e.id, icon: 'fa-solid fa-server', name: e.name, url: buildEnvUrl(e) }; })
                .concat(favTools.map(function(t) { return { type: 'tool', id: t.id, icon: t.icon, name: t.name, data: t }; }))
                .concat(favToolbox.map(function(t) { return { type: 'toolbox', id: t.id, icon: t.icon, name: t.name }; }))
                .concat(quickEntries.map(function(e) { return { type: 'quick', id: 'q' + e.id, icon: e.icon || 'fa-solid fa-link', name: e.name, url: e.url }; }));
              var entries = allEntries.slice(0, 11);
              if (entries.length === 0) return '<div class="empty-state"><p>暂无收藏，去各页面点击星标收藏常用内容吧</p></div>';
              return entries.map(function(e) {
                var isImage = e.icon && (e.icon.startsWith('/icons/') || e.icon.startsWith('http'));
                var iconHtml = isImage ? '<img src="' + escHtml(e.icon) + '" alt="">' : '<i class="' + escHtml(e.icon) + '"></i>';
                if (e.type === 'toolbox') {
                  return '<a class="quick-entry-item home-qe-item home-toolbox-item" data-type="' + e.type + '" data-id="' + e.id + '" href="javascript:void(0)"><span class="qe-icon ' + (isImage ? 'is-image' : '') + '">' + iconHtml + '</span><span class="qe-name">' + escHtml(e.name) + '</span></a>';
                }
                return '<a class="quick-entry-item home-qe-item" data-type="' + e.type + '" data-id="' + e.id + '"' + (e.url ? ' href="' + escHtml(e.url) + '" target="_blank"' : ' href="javascript:void(0)"') + '><span class="qe-icon ' + (isImage ? 'is-image' : '') + '">' + iconHtml + '</span><span class="qe-name">' + escHtml(e.name) + '</span></a>';
              }).join('') + '<a class="quick-entry-item quick-entry-more" href="#favorites" title="查看全部收藏"><span class="qe-icon"><i class="fa-solid fa-ellipsis"></i></span><span class="qe-name">更多</span></a>';
            })() +
          '</div>' +
        '</div>' +
        '<div class="dashboard-section docs-section">' +
          '<h3><i class="fa-solid fa-book-open"></i> 平台文档</h3>' +
          '<div class="docs-link-list">' +
            '<a class="docs-link-item" href="/docs/index.html" target="_blank"><span class="docs-link-icon docs-icon-1"><i class="fa-solid fa-file-lines"></i></span><span class="docs-link-text">文档首页</span><i class="fa-solid fa-arrow-up-right-from-square docs-link-arrow"></i></a>' +
            '<a class="docs-link-item" href="/docs/doc1-benefits.html" target="_blank"><span class="docs-link-icon docs-icon-2"><i class="fa-solid fa-chart-line"></i></span><span class="docs-link-text">建设收益分析</span><i class="fa-solid fa-arrow-up-right-from-square docs-link-arrow"></i></a>' +
            '<a class="docs-link-item" href="/docs/doc2-features.html" target="_blank"><span class="docs-link-icon docs-icon-3"><i class="fa-solid fa-layer-group"></i></span><span class="docs-link-text">功能清单与架构</span><i class="fa-solid fa-arrow-up-right-from-square docs-link-arrow"></i></a>' +
            '<a class="docs-link-item" href="/docs/doc3-tech-design.html" target="_blank"><span class="docs-link-icon docs-icon-4"><i class="fa-solid fa-code"></i></span><span class="docs-link-text">技术设计文档</span><i class="fa-solid fa-arrow-up-right-from-square docs-link-arrow"></i></a>' +
            '<a class="docs-link-item" href="/docs/doc4-deployment.html" target="_blank"><span class="docs-link-icon docs-icon-5"><i class="fa-solid fa-server"></i></span><span class="docs-link-text">部署与运维手册</span><i class="fa-solid fa-arrow-up-right-from-square docs-link-arrow"></i></a>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (_homeClockInterval) {
      clearInterval(_homeClockInterval);
    }
    _homeClockInterval = setInterval(function() {
      var clock = $('#liveClock');
      if (clock) clock.textContent = getNowString();
    }, 1000);

    bindHomeEvents();
  }

  function renderHome(content) {
    // 始终立即渲染，使用现有数据（可能是空的默认数据）
    // 这确保页面在<100ms内显示，不会白屏等待
    renderHomeContent(content, appState.data);

    // 异步加载最新数据后重新渲染
    loadAllData().then(function() {
      renderHomeContent(content, appState.data);
      refreshAllStatuses();
    });
  }

  function bindHomeEvents() {
    var refreshBtn = $('#refreshStatusBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        apiFetch('/status').then(function(statusData) {
          statusData.env_statuses.forEach(function(s) {
            appState.envStatuses[s.id] = s.status;
          });
          updateStatusIndicators();
          var onlineEl = $('#onlineCount');
          if (onlineEl) onlineEl.textContent = statusData.online_envs;
          toast('状态已刷新', 'success');
        }).catch(function() {
          toast('刷新失败', 'error');
        });
      });
    }
    var manageBtn = $('#manageEnvBtn');
    if (manageBtn) {
      manageBtn.addEventListener('click', function() {
        navigateTo('urls');
      });
    }
    $$('.history-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var type = el.dataset.type;
        var id = parseInt(el.dataset.id);
        if (type === 'env') {
          var env = appState.data.envs.find(function(e) { return e.id === id; });
          if (env) {
            addHistory('env', env.id);
            window.open(buildEnvUrl(env), '_blank');
          }
        } else {
          var tool = appState.data.tools.find(function(t) { return t.id === id; });
          if (tool) {
            addHistory('tool', tool.id);
            window.open(tool.url, '_blank');
          }
        }
      });
    });
    $$('.home-qe-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (el.classList.contains('quick-entry-more')) return;
        e.preventDefault();
        var type = el.dataset.type;
        var idVal = el.dataset.id;
        if (type === 'env') {
          var env = appState.data.envs.find(function(x) { return x.id === parseInt(idVal); });
          if (env) {
            addHistory('env', env.id);
            window.open(buildEnvUrl(env), '_blank');
          }
        } else if (type === 'tool') {
          var tool = appState.data.tools.find(function(x) { return x.id === parseInt(idVal); });
          if (tool) {
            addHistory('tool', tool.id);
            window.open(tool.url, '_blank');
          }
        } else if (type === 'toolbox') {
          openToolboxTool(idVal);
        } else if (type === 'quick') {
          var qid = parseInt(idVal.substring(1));
          var entry = (appState.data.quickEntries || []).find(function(x) { return x.id === qid; });
          if (entry && entry.url) window.open(entry.url, '_blank');
        }
      });
    });
  }

  function renderLogin(content) {
    content.innerHTML =
      '<div class="login-container">' +
        '<div class="login-card">' +
          '<div class="login-header">' +
            '<span class="login-logo">🚀</span>' +
            '<h2>工具链平台</h2>' +
            '<p>请登录以继续</p>' +
          '</div>' +
          '<form id="loginForm" class="login-form">' +
            '<div class="form-group">' +
              '<label><i class="fa-solid fa-user"></i> 用户名</label>' +
              '<input type="text" id="loginUsername" placeholder="请输入用户名" required autocomplete="username">' +
            '</div>' +
            '<div class="form-group">' +
              '<label><i class="fa-solid fa-lock"></i> 密码</label>' +
              '<input type="password" id="loginPassword" placeholder="请输入密码" required autocomplete="current-password">' +
            '</div>' +
            '<div id="loginError" class="login-error hidden"></div>' +
            '<button type="submit" class="btn btn-primary login-btn"><i class="fa-solid fa-right-to-bracket"></i> 登录</button>' +
          '</form>' +

        '</div>' +
      '</div>';

    $('#loginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var username = $('#loginUsername').value.trim();
      var password = $('#loginPassword').value;
      var errorEl = $('#loginError');

      if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        errorEl.classList.remove('hidden');
        return;
      }

      apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password })
      }).then(function(result) {
        appState.authToken = result.token;
        appState.currentUser = result.user;
        localStorage.setItem('tcp_token', result.token);
        localStorage.setItem('tcp_user', JSON.stringify(result.user));
        updateTopbarUser();
        toast('登录成功，欢迎 ' + result.user.username, 'success');
        navigateTo('home');
      }).catch(function(err) {
        errorEl.textContent = err.message || '登录失败，请检查用户名和密码';
        errorEl.classList.remove('hidden');
      });
    });
  }

  function renderEnvCard(env, isFav, s, canModify, canDelete, simple) {
    var host = (env.accessType === 'domain' && env.domain) ? env.domain : env.ip;
    var statusDot = '<span class="status-dot ' + s + '"></span>';
    var isOffline = s === 'offline';
    var offlineClass = isOffline ? ' offline-env-card' : '';
    if (simple) {
      var openUrl = buildEnvUrl(env);
      var cardClickAttr = isOffline ? ' data-env-id="' + env.id + '" style="opacity:0.6;cursor:not-allowed;"' : ' data-simple-open-url="' + escHtml(openUrl) + '" data-env-id="' + env.id + '" style="cursor:pointer;"';
      return '<div class="card card-simple' + offlineClass + '"' + cardClickAttr + '>' +
        (appState.currentUser ? '<button class="btn-icon fav-btn' + (isFav ? ' active' : '') + '" data-fav-type="env" data-fav-id="' + env.id + '" title="收藏"><i class="fa-solid fa-star"></i></button>' : '') +
        '<div class="card-header">' +
          '<span class="card-icon"><i class="fa-solid fa-server"></i></span>' +
          '<span class="card-title">' + escHtml(env.name) + '</span>' +
        '</div>' +
        '<div class="card-meta card-meta-simple">' +
          statusDot +
          '<span class="status-text-simple">' + getStatusText(s) + '</span>' +
          '<span class="card-ip-simple">' + escHtml(host) + '</span>' +
        '</div>' +
      '</div>';
    }
    var subLinksHtml = '';
    if (env.subLinks && env.subLinks.length > 0) {
      subLinksHtml = '<div class="env-sublinks">' + env.subLinks.map(function(sl) {
        var subLinkClass = isOffline ? 'env-sublink sublink-disabled' : 'env-sublink';
        var subLinkAttrs = ' data-original-href="' + escHtml(sl.url) + '" data-name="' + escHtml(sl.name) + '"';
        if (isOffline) {
          subLinkAttrs += ' title="无法连接" style="pointer-events:none;opacity:0.5;cursor:not-allowed;"';
        } else {
          subLinkAttrs += ' href="' + escHtml(sl.url) + '" target="_blank" title="' + escHtml(sl.name) + '"';
        }
        return '<a class="' + subLinkClass + '"' + subLinkAttrs + '><i class="fa-solid fa-arrow-up-right-from-square"></i> ' + escHtml(sl.name) + '</a>';
      }).join('') + '</div>';
    }
    return '<div class="card' + offlineClass + '" data-env-id="' + env.id + '">' +
      (appState.currentUser ? '<button class="btn-icon fav-btn' + (isFav ? ' active' : '') + '" data-fav-type="env" data-fav-id="' + env.id + '" title="收藏"><i class="fa-solid fa-star"></i></button>' : '') +
      '<div class="card-header">' +
        '<span class="card-icon"><i class="fa-solid fa-server"></i></span>' +
        '<span class="card-title">' + escHtml(env.name) + '</span>' +
      '</div>' +
      '<div class="card-meta">' +
        '<span class="status-indicator"><span class="dot ' + s + '" data-env-id="' + env.id + '"></span><span class="status-text">' + getStatusText(s) + '</span></span>' +
        '<span style="margin-left:12px;font-family:monospace;">' + escHtml(host) + '</span>' +
      '</div>' +
      '<div class="card-desc">' + escHtml(env.description || '') + '</div>' +
      subLinksHtml +
      '<div class="card-actions">' +
        '<button class="btn btn-sm copy-ip-btn" data-ip="' + escHtml(host) + '"><i class="fa-solid fa-copy"></i> ' + (env.accessType === 'domain' ? '复制域名' : '复制IP') + '</button>' +
        '<button class="btn btn-sm ' + (isOffline ? 'btn-disabled' : 'btn-primary open-env-btn') + '" data-url="' + escHtml(buildEnvUrl(env)) + '" data-env-id="' + env.id + '"' + (isOffline ? ' disabled title="无法连接"' : '') + '><i class="fa-solid fa-arrow-up-right-from-square"></i> ' + (isOffline ? '无法连接' : '打开') + '</button>' +
        (canModify ? '<button class="btn btn-sm edit-env-btn" data-env-id="' + env.id + '"><i class="fa-solid fa-pen-to-square"></i> 编辑</button>' : '') +
        (canDelete ? '<button class="btn btn-sm btn-danger delete-env-btn" data-env-id="' + env.id + '"><i class="fa-solid fa-trash"></i> 删除</button>' : '') +
        (appState.currentUser ? '<button class="btn btn-sm recycle-env-btn" data-env-id="' + env.id + '" data-env-name="' + escHtml(env.name) + '" title="申请回收"><i class="fa-solid fa-recycle"></i></button>' : '') +
      '</div>' +
    '</div>';
  }

  function renderUrlsContent(content, d) {
    var canAdd = hasPermission('add');
    var canDelete = hasPermission('delete');
    var canModify = hasPermission('modify');
    var isSimple = !appState.currentUser || appState.currentUser.role !== 'superadmin';
    var isGuest = !appState.currentUser;
    var hideOfflineClass = (appState.hideOfflineEnvs && !isGuest) ? ' hide-offline-envs' : '';

      var groups = d.envGroups && d.envGroups.length > 0 ? d.envGroups.filter(function(g) { return g.visible !== false; }) : [{id:'env',name:'环境',order:1},{id:'service',name:'服务',order:2},{id:'other',name:'其他',order:3}];
      groups.sort(function(a,b){ return (a.order||0) - (b.order||0); });

      var mineGroups = d.mineGroups && d.mineGroups.length > 0 ? d.mineGroups.filter(function(g) { return g.visible !== false; }) : [];
      mineGroups.sort(function(a,b){ return (a.order||0) - (b.order||0); });

      var html = '<div id="urlsContent" class="urls-content' + hideOfflineClass + '">';
      html += '<h2 class="page-title" style="display:flex;align-items:center;">🌐 网址大全' +
        (isGuest ? '' : '<button class="btn btn-sm ' + (appState.hideOfflineEnvs ? 'btn-primary' : 'btn-secondary') + '" id="toggleOfflineBtn" style="margin-left:12px;vertical-align:middle;transition:all 0.2s ease;"><i class="fa-solid ' + (appState.hideOfflineEnvs ? 'fa-eye-slash' : 'fa-eye') + '"></i> ' + (appState.hideOfflineEnvs ? '显示离线环境' : '隐藏离线环境') + '</button>') +
        '</h2>' +
        (canAdd ? '<div style="margin-bottom:16px;"><button class="btn btn-primary" id="addEnvBtn"><i class="fa-solid fa-plus"></i> 新增</button> ' + (canModify ? '<button class="btn btn-primary" id="manageMineGroupsBtn"><i class="fa-solid fa-object-group"></i> 管理矿区分组</button>' : '') + '</div>' : '');

      function isCloudEnv(env) {
        var name = (env.name || '').toLowerCase();
        return name.indexOf('云端') !== -1;
      }

      groups.forEach(function(g) {
        var groupEnvs = d.envs.filter(function(env) { return (env.group || '环境') === g.name; });
        if (isSimple) {
          groupEnvs = groupEnvs.filter(function(env) { return !isCloudEnv(env); });
        }
        if (groupEnvs.length === 0) return;

        var groupHtml = '<div class="env-group-section" data-group-id="' + escHtml(g.id) + '">' +
          '<h3 class="env-group-title"><i class="fa-solid fa-folder-open"></i> ' + escHtml(g.name) + '</h3>';
        var groupInnerHtml = '';

        if (g.name === '环境' && mineGroups.length > 0) {
          mineGroups.forEach(function(mg) {
            var mineEnvs = groupEnvs.filter(function(env) { return (env.mine || '') === mg.name; });
            if (mineEnvs.length === 0) return;
            groupInnerHtml += '<div class="mine-group-section" data-mine-id="' + escHtml(mg.id) + '">' +
              '<h4 class="mine-group-title"><i class="fa-solid fa-mountain-sun"></i> ' + escHtml(mg.name) + '</h4>' +
              '<div class="card-grid' + (isSimple ? ' card-grid-simple' : '') + '">' +
              mineEnvs.map(function(env) {
                var s = appState.envStatuses[env.id] || 'unknown';
                var isFav = d.favorites.envs && d.favorites.envs.indexOf(env.id) !== -1;
                return renderEnvCard(env, isFav, s, canModify, canDelete, isSimple);
              }).join('') +
              '</div></div>';
          });
          var ungroupedEnvs = groupEnvs.filter(function(env) { return !env.mine || !mineGroups.some(function(mg) { return mg.name === env.mine; }); });
          if (ungroupedEnvs.length > 0) {
            groupInnerHtml += '<div class="mine-group-section" data-mine-id="ungrouped">' +
              '<h4 class="mine-group-title"><i class="fa-solid fa-folder"></i> 未分组</h4>' +
              '<div class="card-grid' + (isSimple ? ' card-grid-simple' : '') + '">' +
              ungroupedEnvs.map(function(env) {
                var s = appState.envStatuses[env.id] || 'unknown';
                var isFav = d.favorites.envs && d.favorites.envs.indexOf(env.id) !== -1;
                return renderEnvCard(env, isFav, s, canModify, canDelete, isSimple);
              }).join('') +
              '</div></div>';
          }
        } else {
          groupInnerHtml = '<div class="card-grid' + (isSimple ? ' card-grid-simple' : '') + '">' +
          groupEnvs.map(function(env) {
            var s = appState.envStatuses[env.id] || 'unknown';
            var isFav = d.favorites.envs && d.favorites.envs.indexOf(env.id) !== -1;
            return renderEnvCard(env, isFav, s, canModify, canDelete, isSimple);
          }).join('') +
          '</div>';
        }

        html += groupHtml + groupInnerHtml + '</div>';
      });

      // 数据为空时显示加载提示，避免空白
      if (d.envs.length === 0) {
        html += '<div style="text-align:center;padding:60px 20px;color:var(--text-muted,#6b7280);"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;margin-right:12px;"></i><span>数据加载中...</span></div>';
      }

      html += '</div>';
      content.innerHTML = html;
      applyOfflineVisibility();
      bindUrlsEvents();
    }

  function renderUrls(content) {
    var isPublic = !appState.currentUser;
    // 始终立即渲染，使用现有数据
    renderUrlsContent(content, appState.data);

    var dataLoader = isPublic ? loadPublicData() : loadAllData();
    dataLoader.then(function() {
      renderUrlsContent(content, appState.data);
      return refreshAllStatuses();
    }).then(function() {
      if (appState.hideOfflineEnvs && appState.currentUser) {
        updateStatusIndicators();
      }
    });
  }

  function bindUrlsEvents() {
    $$('.copy-ip-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.dataset.ip).then(function() {
          toast(btn.textContent.indexOf('域名') > -1 ? '域名已复制' : 'IP已复制', 'success');
        }).catch(function() {
          toast('复制失败', 'error');
        });
      });
    });
    $$('.open-env-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        addHistory('env', parseInt(btn.dataset.envId));
        window.open(btn.dataset.url, '_blank');
      });
    });
    $$('.fav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleFavorite(btn.dataset.favType, btn.dataset.favId, btn);
      });
    });
    $$('.delete-env-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var envId = parseInt(btn.dataset.envId);
        if (confirm('确定要删除该环境吗？')) {
          apiFetch('/envs/' + envId, { method: 'DELETE' }).then(function() {
            toast('环境已删除', 'success');
            renderRoute('urls');
          }).catch(function(err) {
            toast('删除失败: ' + err.message, 'error');
          });
        }
      });
    });
    // T2.2：申请回收
    $$('.recycle-env-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var envId = parseInt(btn.dataset.envId);
        var envName = btn.dataset.envName || ('env#' + envId);
        if (window.ToolchainApp && ToolchainApp.openRecycleDialog) {
          ToolchainApp.openRecycleDialog('env', envId, envName);
        } else {
          toast('回收模块未加载', 'error');
        }
      });
    });
    $$('.edit-env-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var envId = parseInt(btn.dataset.envId);
        var env = appState.data.envs.find(function(e) { return e.id === envId; });
        if (env) showEnvEditModal(env);
      });
    });
    $$('.card-simple[data-simple-open-url]').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.fav-btn')) return;
        if (appState.currentUser) addHistory('env', parseInt(card.dataset.envId));
        window.open(card.dataset.simpleOpenUrl, '_blank');
      });
    });
    var addBtn = $('#addEnvBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        showEnvAddModal();
      });
    }
    var manageMineGroupsBtn = $('#manageMineGroupsBtn');
    if (manageMineGroupsBtn) {
      manageMineGroupsBtn.addEventListener('click', function() {
        showMineGroupsManageModal();
      });
    }
    var toggleOfflineBtn = $('#toggleOfflineBtn');
    if (toggleOfflineBtn) {
      toggleOfflineBtn.addEventListener('click', function() {
        appState.hideOfflineEnvs = !appState.hideOfflineEnvs;
        localStorage.setItem('tcp_hideOfflineEnvs', appState.hideOfflineEnvs);
        toggleOfflineBtn.className = 'btn btn-sm ' + (appState.hideOfflineEnvs ? 'btn-primary' : 'btn-secondary');
        toggleOfflineBtn.innerHTML = '<i class="fa-solid ' + (appState.hideOfflineEnvs ? 'fa-eye-slash' : 'fa-eye') + '"></i> ' + (appState.hideOfflineEnvs ? '显示离线环境' : '隐藏离线环境');
        applyOfflineVisibility();
        toast(appState.hideOfflineEnvs ? '已隐藏离线环境' : '已显示全部环境', 'success');
      });
    }
  }

  function showEnvAddModal() {
    var groups = appState.data.envGroups || [];
    var groupOptions = groups.length > 0 ? groups.map(function(g) { return '<option value="' + escHtml(g.name) + '">' + escHtml(g.name) + '</option>'; }).join('') : '<option value="环境">环境</option><option value="服务">服务</option><option value="其他">其他</option>';
    var mineGroups = appState.data.mineGroups || [];
    var mineOptions = '<option value="">无</option>' + mineGroups.map(function(g) { return '<option value="' + escHtml(g.name) + '">' + escHtml(g.name) + '</option>'; }).join('');
    var bodyHtml =
      '<div class="form-group"><label>名称</label><input type="text" id="envName" placeholder="环境名称" required></div>' +
      '<div class="form-group"><label>访问方式</label><div style="display:flex;gap:16px;">' +
        '<label><input type="radio" name="envAccessType" value="ip" checked> IP/端口/路径</label>' +
        '<label><input type="radio" name="envAccessType" value="domain"> 域名</label>' +
      '</div></div>' +
      '<div id="envIpFields">' +
        '<div class="form-group"><label>IP地址</label><input type="text" id="envIp" placeholder="IP地址" required></div>' +
        '<div class="form-group"><label>端口</label><input type="number" id="envPort" value="80"></div>' +
        '<div class="form-group"><label>路径</label><input type="text" id="envPath" value="/" placeholder="如 /#/login"></div>' +
      '</div>' +
      '<div id="envDomainFields" style="display:none;">' +
        '<div class="form-group"><label>域名</label><input type="text" id="envDomain" placeholder="如 example.com"></div>' +
        '<div class="form-group"><label>路径</label><input type="text" id="envDomainPath" value="/" placeholder="如 /#/login"></div>' +
      '</div>' +
      '<div class="form-group"><label>协议</label><select id="envProtocol"><option value="http">http</option><option value="https">https</option></select></div>' +
      '<div class="form-group"><label>分组</label><select id="envGroup">' + groupOptions + '</select></div>' +
      '<div class="form-group"><label>矿区</label><select id="envMine">' + mineOptions + '</select></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="envDesc" placeholder="环境描述"></div>' +
      '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveEnvBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';

    showModal('新增', bodyHtml);

    $$('input[name="envAccessType"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var accessType = this.value;
        $('#envIpFields').style.display = accessType === 'ip' ? '' : 'none';
        $('#envDomainFields').style.display = accessType === 'domain' ? '' : 'none';
      });
    });

    $('#saveEnvBtn').addEventListener('click', function() {
      var accessType = $$('input[name="envAccessType"]:checked')[0].value;
      var data = {
        name: $('#envName').value.trim(),
        protocol: $('#envProtocol').value,
        group: $('#envGroup').value,
        mine: $('#envMine').value,
        description: $('#envDesc').value.trim(),
        accessType: accessType
      };
      if (accessType === 'ip') {
        data.ip = $('#envIp').value.trim();
        data.port = parseInt($('#envPort').value) || 80;
        data.path = $('#envPath').value.trim() || '/';
        if (!data.name || !data.ip) { toast('请填写名称和IP', 'error'); return; }
      } else {
        data.domain = $('#envDomain').value.trim();
        data.path = $('#envDomainPath').value.trim() || '/';
        if (!data.name || !data.domain) { toast('请填写名称和域名', 'error'); return; }
      }
      apiFetch('/envs', { method: 'POST', body: JSON.stringify(data) }).then(function() {
        toast('环境已添加', 'success');
        closeModal();
        renderRoute('urls');
      }).catch(function(err) {
        toast('添加失败: ' + err.message, 'error');
      });
    });
  }

  function showEnvEditModal(env) {
    var groups = appState.data.envGroups || [];
    var groupOptions = groups.length > 0 ? groups.map(function(g) { return '<option value="' + escHtml(g.name) + '"' + ((env.group || '环境') === g.name ? ' selected' : '') + '>' + escHtml(g.name) + '</option>'; }).join('') : '<option value="环境"' + ((env.group || '环境') === '环境' ? ' selected' : '') + '>环境</option><option value="服务"' + ((env.group || '环境') === '服务' ? ' selected' : '') + '>服务</option><option value="其他"' + ((env.group || '环境') === '其他' ? ' selected' : '') + '>其他</option>';
    var mineGroups = appState.data.mineGroups || [];
    var mineOptions = '<option value="">无</option>' + mineGroups.map(function(g) { return '<option value="' + escHtml(g.name) + '"' + ((env.mine || '') === g.name ? ' selected' : '') + '>' + escHtml(g.name) + '</option>'; }).join('');
    var subLinksVal = env.subLinks ? JSON.stringify(env.subLinks) : '[]';
    var accessType = env.accessType || 'ip';
    var ipFieldsDisplay = accessType === 'ip' ? '' : 'none';
    var domainFieldsDisplay = accessType === 'domain' ? '' : 'none';
    var bodyHtml =
      '<div class="form-group"><label>名称</label><input type="text" id="envName" value="' + escHtml(env.name) + '" required></div>' +
      '<div class="form-group"><label>访问方式</label><div style="display:flex;gap:16px;">' +
        '<label><input type="radio" name="envAccessType" value="ip"' + (accessType === 'ip' ? ' checked' : '') + '> IP/端口/路径</label>' +
        '<label><input type="radio" name="envAccessType" value="domain"' + (accessType === 'domain' ? ' checked' : '') + '> 域名</label>' +
      '</div></div>' +
      '<div id="envIpFields" style="display:' + ipFieldsDisplay + ';">' +
        '<div class="form-group"><label>IP地址</label><input type="text" id="envIp" value="' + escHtml(env.ip || '') + '" required></div>' +
        '<div class="form-group"><label>端口</label><input type="number" id="envPort" value="' + (env.port || 80) + '"></div>' +
        '<div class="form-group"><label>路径</label><input type="text" id="envPath" value="' + escHtml(env.path || '/') + '"></div>' +
      '</div>' +
      '<div id="envDomainFields" style="display:' + domainFieldsDisplay + ';">' +
        '<div class="form-group"><label>域名</label><input type="text" id="envDomain" value="' + escHtml(env.domain || '') + '"></div>' +
        '<div class="form-group"><label>路径</label><input type="text" id="envDomainPath" value="' + escHtml(env.path || '/') + '"></div>' +
      '</div>' +
      '<div class="form-group"><label>协议</label><select id="envProtocol"><option value="http"' + (env.protocol === 'http' ? ' selected' : '') + '>http</option><option value="https"' + (env.protocol === 'https' ? ' selected' : '') + '>https</option></select></div>' +
      '<div class="form-group"><label>分组</label><select id="envGroup">' + groupOptions + '</select></div>' +
      '<div class="form-group"><label>矿区</label><select id="envMine">' + mineOptions + '</select></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="envDesc" value="' + escHtml(env.description || '') + '"></div>' +
      '<div class="form-group"><label>子链接 (JSON格式)</label><textarea id="envSubLinks" rows="3" placeholder="[{&quot;name&quot;:&quot;后台管理&quot;,&quot;url&quot;:&quot;http://...&quot;}]">' + escHtml(subLinksVal) + '</textarea></div>' +
      '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveEnvBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';

    showModal('编辑环境', bodyHtml);

    $$('input[name="envAccessType"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var at = this.value;
        $('#envIpFields').style.display = at === 'ip' ? '' : 'none';
        $('#envDomainFields').style.display = at === 'domain' ? '' : 'none';
      });
    });

    $('#saveEnvBtn').addEventListener('click', function() {
      var accessType = $$('input[name="envAccessType"]:checked')[0].value;
      var data = {
        name: $('#envName').value.trim(),
        protocol: $('#envProtocol').value,
        group: $('#envGroup').value,
        mine: $('#envMine').value,
        description: $('#envDesc').value.trim(),
        accessType: accessType
      };
      if (accessType === 'ip') {
        data.ip = $('#envIp').value.trim();
        data.port = parseInt($('#envPort').value) || 80;
        data.path = $('#envPath').value.trim() || '/';
        if (!data.name || !data.ip) { toast('请填写名称和IP', 'error'); return; }
      } else {
        data.domain = $('#envDomain').value.trim();
        data.path = $('#envDomainPath').value.trim() || '/';
        if (!data.name || !data.domain) { toast('请填写名称和域名', 'error'); return; }
      }
      var subLinksText = $('#envSubLinks').value.trim();
      if (subLinksText) {
        try { data.subLinks = JSON.parse(subLinksText); } catch(e) { toast('子链接JSON格式错误', 'error'); return; }
      }
      apiFetch('/envs/' + env.id, { method: 'PUT', body: JSON.stringify(data) }).then(function() {
        toast('环境已更新', 'success');
        closeModal();
        renderRoute('urls');
      }).catch(function(err) {
        toast('更新失败: ' + err.message, 'error');
      });
    });
  }

  function showMineGroupsManageModal() {
    var mineGroups = appState.data.mineGroups || [];
    var groupsHtml = mineGroups.map(function(g, idx) {
      return '<div class="mine-group-item" data-mine-id="' + escHtml(g.id) + '">' +
        '<input type="text" class="mine-group-name-input" value="' + escHtml(g.name) + '" data-mine-id="' + escHtml(g.id) + '" style="flex:1;margin-right:8px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;">' +
        '<label style="margin-right:8px;"><input type="checkbox" class="mine-group-visible-check" data-mine-id="' + escHtml(g.id) + '"' + (g.visible !== false ? ' checked' : '') + '> 显示</label>' +
        '<button class="btn btn-sm btn-danger delete-mine-group-btn" data-mine-id="' + escHtml(g.id) + '"><i class="fa-solid fa-trash"></i></button>' +
      '</div>';
    }).join('');

    var bodyHtml =
      '<div class="settings-desc" style="margin-bottom:12px;">管理矿区分组，添加、删除或修改矿区名称</div>' +
      '<div id="mineGroupsManageList" style="margin-bottom:12px;">' + groupsHtml + '</div>' +
      '<div style="margin-bottom:16px;"><button class="btn btn-sm btn-primary" id="addMineGroupBtn"><i class="fa-solid fa-plus"></i> 添加矿区</button></div>' +
      '<div style="text-align:right;"><button class="btn btn-primary" id="saveMineGroupsBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';

    showModal('管理矿区分组', bodyHtml);

    var listEl = $('#mineGroupsManageList');

    $('#addMineGroupBtn').addEventListener('click', function() {
      var newId = 'mine_' + Date.now();
      var div = document.createElement('div');
      div.className = 'mine-group-item';
      div.dataset.mineId = newId;
      div.innerHTML = '<input type="text" class="mine-group-name-input" value="新矿区" data-mine-id="' + newId + '" style="flex:1;margin-right:8px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;">' +
        '<label style="margin-right:8px;"><input type="checkbox" class="mine-group-visible-check" data-mine-id="' + newId + '" checked> 显示</label>' +
        '<button class="btn btn-sm btn-danger delete-mine-group-btn" data-mine-id="' + newId + '"><i class="fa-solid fa-trash"></i></button>';
      listEl.appendChild(div);
      bindMineGroupItemEvents(div);
    });

    function bindMineGroupItemEvents(item) {
      var delBtn = item.querySelector('.delete-mine-group-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function() {
          item.remove();
        });
      }
    }

    $$('.mine-group-item').forEach(bindMineGroupItemEvents);

    $('#saveMineGroupsBtn').addEventListener('click', function() {
      var items = Array.from($$('#mineGroupsManageList .mine-group-item'));
      var newGroups = items.map(function(item, idx) {
        var mid = item.dataset.mineId;
        var nameInput = item.querySelector('.mine-group-name-input[data-mine-id="' + mid + '"]');
        var visibleCheck = item.querySelector('.mine-group-visible-check[data-mine-id="' + mid + '"]');
        return {
          id: mid,
          name: nameInput ? nameInput.value.trim() : mid,
          order: idx,
          visible: visibleCheck ? visibleCheck.checked : true
        };
      });
      apiFetch('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mineGroups: newGroups })
      }).then(function() {
        appState.data.mineGroups = newGroups;
        toast('矿区分组已保存', 'success');
        closeModal();
        renderRoute('urls');
      }).catch(function(err) {
        toast('保存失败: ' + err.message, 'error');
      });
    });
  }

  function renderTools(content) {
    loadAllData().then(function() {
      var d = appState.data;
      var cats = d.categories[appState.currentOs] || [];
      var groups = d.toolCompanyGroups || [];
      var tags = d.toolTags || [];
      var filteredTools = d.tools.filter(function(t) {
        if (t.os !== appState.currentOs) return false;
        if (appState.currentCategory && t.category !== appState.currentCategory) return false;
        if (appState.currentCompanyGroup && (t.company_group || 'general') !== appState.currentCompanyGroup) return false;
        if (appState.currentTag && (t.tags || []).indexOf(appState.currentTag) === -1) return false;
        return true;
      });
      filteredTools.sort(function(a, b) {
        if (a.category !== b.category) return a.category.localeCompare(b.category, 'zh');
        return a.name.localeCompare(b.name, 'zh');
      });
      var canAdd = hasPermission('add');
      var canDelete = hasPermission('delete');
      var canModify = hasPermission('modify');

      var groupChips = groups.map(function(g) {
        var active = appState.currentCompanyGroup === g.id ? ' active' : '';
        return '<button class="cat-chip' + active + '" data-group-filter="' + escHtml(g.id) + '" style="border-left:3px solid ' + g.color + '"><i class="' + escHtml(g.icon) + '"></i> ' + escHtml(g.name) + '</button>';
      }).join('');

      var tagChips = tags.map(function(t) {
        var active = appState.currentTag === t ? ' active' : '';
        return '<button class="cat-chip tag-chip' + active + '" data-tag-filter="' + escHtml(t) + '"><i class="fa-solid fa-tag"></i> ' + escHtml(t) + '</button>';
      }).join('');

      content.innerHTML = '<h2 class="page-title">🛠 软件管家</h2>' +
        '<div class="tabs" id="toolOsTabs">' +
          '<button class="tab-btn' + (appState.currentOs === 'windows' ? ' active' : '') + '" data-os="windows"><i class="fa-brands fa-windows"></i> Windows</button>' +
          '<button class="tab-btn' + (appState.currentOs === 'ubuntu' ? ' active' : '') + '" data-os="ubuntu"><i class="fa-brands fa-ubuntu"></i> Ubuntu</button>' +
        '</div>' +
        '<div class="filter-section" style="margin-bottom:12px;" id="toolGroupFilter">' +
          '<div class="filter-label" style="font-size:12px;color:var(--text-muted);margin-bottom:6px;"><i class="fa-solid fa-users"></i> 公司分组</div>' +
          '<div class="category-filter">' +
            '<button class="cat-chip' + (!appState.currentCompanyGroup ? ' active' : '') + '" data-group-filter="">全部</button>' +
            groupChips +
          '</div>' +
        '</div>' +
        (tags.length > 0 ? '<div class="filter-section" style="margin-bottom:12px;" id="toolTagFilter">' +
          '<div class="filter-label" style="font-size:12px;color:var(--text-muted);margin-bottom:6px;"><i class="fa-solid fa-tags"></i> 标签</div>' +
          '<div class="category-filter">' +
            '<button class="cat-chip tag-chip' + (!appState.currentTag ? ' active' : '') + '" data-tag-filter="">全部</button>' +
            tagChips +
          '</div>' +
        '</div>' : '') +
        (canAdd ? '<div style="margin-bottom:16px;"><button class="btn btn-primary" id="addToolBtn"><i class="fa-solid fa-plus"></i> 添加工具</button></div>' : '') +
        '<div class="card-grid' + (appState.toolView === 'list' ? ' list-view' : '') + '">' +
          (filteredTools.length === 0 ? '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>暂无符合筛选条件的工具</p></div>' :
          filteredTools.map(function(t) {
            var isFav = d.favorites.tools && d.favorites.tools.indexOf(t.id) !== -1;
            var iconHtml = t.icon && (t.icon.startsWith('/icons/') || t.icon.startsWith('http')) 
              ? '<img src="' + escHtml(t.icon) + '" style="width:28px;height:28px;object-fit:contain;">' 
              : '<i class="' + escHtml(t.icon || 'fa-solid fa-gear') + '"></i>';
            var groupInfo = groups.find(function(g) { return g.id === (t.company_group || 'general'); }) || groups[0];
            var groupBadge = groupInfo ? '<span class="group-badge" style="background:' + groupInfo.color + '20;color:' + groupInfo.color + ';border:1px solid ' + groupInfo.color + '40;padding:1px 6px;border-radius:10px;font-size:11px;"><i class="' + escHtml(groupInfo.icon) + '"></i> ' + escHtml(groupInfo.name) + '</span>' : '';
            var tagHtml = (t.tags || []).map(function(tag) {
              return '<span class="tag-badge" style="background:var(--primary-light);color:var(--primary-color);padding:1px 6px;border-radius:10px;font-size:11px;margin-left:4px;"><i class="fa-solid fa-tag"></i> ' + escHtml(tag) + '</span>';
            }).join('');
            return '<div class="card">' +
              '<button class="btn-icon fav-btn' + (isFav ? ' active' : '') + '" data-fav-type="tool" data-fav-id="' + t.id + '" title="收藏"><i class="fa-solid fa-star"></i></button>' +
              '<div class="card-header" data-category="' + escHtml(t.category) + '">' +
                '<span class="card-icon">' + iconHtml + '</span>' +
                '<span class="card-title">' + escHtml(t.name) + '</span>' +
              '</div>' +
              '<div style="margin:4px 0 8px 0;">' + groupBadge + tagHtml + '</div>' +
              '<div class="card-desc">' + escHtml(t.description) + '</div>' +
              '<div class="card-actions">' +
                (canModify && t.command ? '<button class="btn btn-sm copy-cmd-btn" data-cmd="' + escHtml(t.command) + '"><i class="fa-solid fa-copy"></i> 复制命令</button>' : '') +
                (t.link && t.link.trim() ? '<button class="btn btn-sm btn-primary open-link-btn" data-link="' + escHtml(t.link) + '" data-tool-id="' + t.id + '"><i class="fa-solid fa-arrow-up-right-from-square"></i> 官网</button>' : '') +
                (t.package_name && t.package_name.trim() ? '<button class="btn btn-sm btn-success download-tool-btn" data-tool-id="' + t.id + '" data-name="' + escHtml(t.name) + '"><i class="fa-solid fa-download"></i> 下载</button>' : '') +
                '<button class="btn btn-sm tool-detail-btn" data-tool-id="' + t.id + '"><i class="fa-solid fa-circle-info"></i> 详情</button>' +
                (canModify ? '<button class="btn btn-sm edit-tool-btn" data-tool-id="' + t.id + '"><i class="fa-solid fa-pen-to-square"></i> 编辑</button>' : '') +
                (canDelete ? '<button class="btn btn-sm btn-danger delete-tool-btn" data-tool-id="' + t.id + '"><i class="fa-solid fa-trash"></i> 删除</button>' : '') +
              '</div>' +
            '</div>';
          }).join('')) +
        '</div>';

      bindToolsEvents();
    });
  }

  function bindToolsEvents() {
    $$('.tab-btn[data-os]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        appState.currentOs = btn.dataset.os;
        appState.currentCategory = '';
        appState.currentCompanyGroup = '';
        appState.currentTag = '';
        _currentRenderRoute = null;
        renderRoute('tools');
      });
    });
    $$('.cat-chip[data-group-filter]').forEach(function(chip) {
      chip.addEventListener('click', function() {
        appState.currentCompanyGroup = chip.dataset.groupFilter;
        _currentRenderRoute = null;
        renderRoute('tools');
      });
    });
    $$('.cat-chip[data-tag-filter]').forEach(function(chip) {
      chip.addEventListener('click', function() {
        appState.currentTag = chip.dataset.tagFilter;
        _currentRenderRoute = null;
        renderRoute('tools');
      });
    });
    $$('.copy-cmd-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.dataset.cmd).then(function() {
          toast('命令已复制', 'success');
        }).catch(function() {
          toast('复制失败', 'error');
        });
      });
    });
    $$('.open-link-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        addHistory('tool', parseInt(btn.dataset.toolId));
        window.open(btn.dataset.link, '_blank');
      });
    });
    $$('.download-tool-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var toolId = parseInt(btn.dataset.toolId);
        var toolName = btn.dataset.name;
        try {
          var res = await fetch(API_BASE + '/tools/' + toolId + '/download', {
            headers: { 'Authorization': 'Bearer ' + appState.authToken }
          });
          if (!res.ok) throw new Error('Download failed');
          var blob = await res.blob();
          var disposition = res.headers.get('Content-Disposition');
          var filename = toolName;
          if (disposition) {
            var utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            if (utf8Match) {
              filename = decodeURIComponent(utf8Match[1]);
            } else {
              var asciiMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (asciiMatch) filename = asciiMatch[1].replace(/['"]/g, '');
            }
          }
          var url = window.URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast('开始下载: ' + toolName, 'success');
        } catch(e) {
          toast('下载失败: ' + e.message, 'error');
        }
      });
    });
    $$('.tool-detail-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var toolId = parseInt(btn.dataset.toolId);
        var tool = appState.data.tools.find(function(t) { return t.id === toolId; });
        if (tool) showToolDetail(tool);
      });
    });
    $$('.fav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleFavorite(btn.dataset.favType, btn.dataset.favId, btn);
      });
    });
    $$('.delete-tool-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var toolId = parseInt(btn.dataset.toolId);
        if (confirm('确定要删除该工具吗？')) {
          apiFetch('/tools/' + toolId, { method: 'DELETE' }).then(function() {
            toast('工具已删除', 'success');
            renderRoute('tools');
          }).catch(function(err) {
            toast('删除失败: ' + err.message, 'error');
          });
        }
      });
    });
    $$('.edit-tool-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var toolId = parseInt(btn.dataset.toolId);
        var tool = appState.data.tools.find(function(t) { return t.id === toolId; });
        if (tool) showToolEditModal(tool);
      });
    });
    var addBtn = $('#addToolBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        showToolAddModal();
      });
    }
  }

  function showToolAddModal() {
    var cats = appState.data.categories[appState.currentOs] || [];
    var groups = appState.data.toolCompanyGroups || [];
    var groupOptions = groups.map(function(g) {
      return '<option value="' + escHtml(g.id) + '">' + escHtml(g.name) + '</option>';
    }).join('');
    var bodyHtml =
      '<div class="form-group"><label>名称</label><input type="text" id="toolName" placeholder="工具名称" required></div>' +
      '<div class="form-group"><label>系统</label><select id="toolOs"><option value="windows"' + (appState.currentOs === 'windows' ? ' selected' : '') + '>Windows</option><option value="ubuntu"' + (appState.currentOs === 'ubuntu' ? ' selected' : '') + '>Ubuntu</option></select></div>' +
      '<div class="form-group"><label>公司分组</label><select id="toolCompanyGroup">' + groupOptions + '</select></div>' +
      '<div class="form-group"><label>分类</label><select id="toolCategory">' + cats.map(function(c) { return '<option value="' + escHtml(c) + '">' + escHtml(c) + '</option>'; }).join('') + '<option value="__new__">+ 新建分类</option></select></div>' +
      '<div class="form-group" id="newCategoryGroup" style="display:none;"><label>新分类名称</label><input type="text" id="toolNewCategory" placeholder="输入新分类名称"></div>' +
      '<div class="form-group"><label>标签（多个标签用逗号分隔）</label><input type="text" id="toolTags" placeholder="例如：开发工具,常用,必备"></div>' +
      '<div class="form-group"><label>图标</label><input type="text" id="toolIcon" value="fa-solid fa-gear" placeholder="点击选择图标或输入FontAwesome类名"></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="toolDesc" placeholder="工具描述"></div>' +
      '<div class="form-group"><label>命令</label><input type="text" id="toolCommand" placeholder="启动命令（可选，管理员可见）"></div>' +
      '<div class="form-group"><label>官网链接</label><input type="text" id="toolLink" placeholder="官网链接（无安装包时用户可跳转官网）"></div>' +
      '<div class="form-group"><label>安装包（可选，上传后用户可直接下载）</label><input type="file" id="toolPackage" accept=".exe,.msi,.deb,.rpm,.zip,.tar.gz,.7z,.dmg,.pkg"></div>' +
      '<div id="packageUploadStatus" style="font-size:12px;color:var(--text-muted);margin-top:-8px;"></div>' +
      '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveToolBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';

    showModal('添加工具', bodyHtml);
    initIconSelector('toolIcon');

    $('#toolCategory').addEventListener('change', function() {
      $('#newCategoryGroup').style.display = this.value === '__new__' ? 'block' : 'none';
    });

    $('#saveToolBtn').addEventListener('click', async function() {
      var category = $('#toolCategory').value;
      if (category === '__new__') {
        category = $('#toolNewCategory').value.trim();
        if (!category) { toast('请输入新分类名称', 'error'); return; }
      }
      var tagsStr = $('#toolTags').value.trim();
      var tags = tagsStr ? tagsStr.split(/[,，]/).map(function(t) { return t.trim(); }).filter(function(t) { return t; }) : [];
      var data = {
        name: $('#toolName').value.trim(),
        os: $('#toolOs').value,
        company_group: $('#toolCompanyGroup').value || 'general',
        category: category,
        tags: tags,
        icon: $('#toolIcon').value.trim() || 'fa-solid fa-gear',
        description: $('#toolDesc').value.trim(),
        command: $('#toolCommand').value.trim(),
        link: $('#toolLink').value.trim()
      };
      if (!data.name) { toast('请填写工具名称', 'error'); return; }
      var pkgInput = $('#toolPackage');
      var pkgFile = pkgInput && pkgInput.files.length > 0 ? pkgInput.files[0] : null;
      
      var saveBtn = this;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
      
      try {
        var newTool = await apiFetch('/tools', { method: 'POST', body: JSON.stringify(data) });
        if (pkgFile) {
          var statusEl = $('#packageUploadStatus');
          if (statusEl) statusEl.textContent = '正在上传安装包...';
          var formData = new FormData();
          formData.append('file', pkgFile);
          var token = appState.authToken;
          var uploadRes = await fetch(API_BASE + '/tools/' + newTool.id + '/upload-package', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
          });
          if (!uploadRes.ok) {
            var errMsg = '安装包上传失败';
            try {
              var errData = await uploadRes.json();
              errMsg = errData.detail || errMsg;
            } catch(e) {}
            throw new Error(errMsg + ' (HTTP ' + uploadRes.status + ')');
          }
          if (statusEl) statusEl.textContent = '安装包上传成功';
        }
        toast('工具已添加', 'success');
        closeModal();
        renderRoute('tools');
      } catch(err) {
        toast('添加失败: ' + err.message, 'error');
        console.error('Add tool error:', err);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> 保存';
      }
    });
  }

  function showToolEditModal(tool) {
    var cats = appState.data.categories[tool.os] || [];
    var groups = appState.data.toolCompanyGroups || [];
    var groupOptions = groups.map(function(g) {
      return '<option value="' + escHtml(g.id) + '"' + ((tool.company_group || 'general') === g.id ? ' selected' : '') + '>' + escHtml(g.name) + '</option>';
    }).join('');
    var tagsStr = (tool.tags || []).join(', ');
    var pkgInfo = '';
    if (tool.package_name && tool.package_size) {
      var sizeStr = (tool.package_size / 1024 / 1024).toFixed(2) + ' MB';
      pkgInfo = '<div class="form-group"><label>当前安装包</label><div style="display:flex;align-items:center;gap:8px;font-size:13px;">' +
        '<i class="fa-solid fa-file-archive" style="color:var(--success-color);"></i>' +
        '<span>已上传 (' + sizeStr + ')</span>' +
        '<button class="btn btn-sm btn-danger" id="deletePackageBtn" style="margin-left:auto;"><i class="fa-solid fa-trash"></i> 删除</button>' +
        '</div></div>';
    }
    var bodyHtml =
      '<div class="form-group"><label>名称</label><input type="text" id="toolName" value="' + escHtml(tool.name) + '" required></div>' +
      '<div class="form-group"><label>系统</label><select id="toolOs"><option value="windows"' + (tool.os === 'windows' ? ' selected' : '') + '>Windows</option><option value="ubuntu"' + (tool.os === 'ubuntu' ? ' selected' : '') + '>Ubuntu</option></select></div>' +
      '<div class="form-group"><label>公司分组</label><select id="toolCompanyGroup">' + groupOptions + '</select></div>' +
      '<div class="form-group"><label>分类</label><select id="toolCategory">' + cats.map(function(c) { return '<option value="' + escHtml(c) + '"' + (tool.category === c ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '<option value="__new__">+ 新建分类</option></select></div>' +
      '<div class="form-group" id="newCategoryGroup" style="display:none;"><label>新分类名称</label><input type="text" id="toolNewCategory" placeholder="输入新分类名称"></div>' +
      '<div class="form-group"><label>标签（多个标签用逗号分隔）</label><input type="text" id="toolTags" value="' + escHtml(tagsStr) + '" placeholder="例如：开发工具,常用,必备"></div>' +
      '<div class="form-group"><label>图标 (FontAwesome类名)</label><input type="text" id="toolIcon" value="' + escHtml(tool.icon) + '"></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="toolDesc" value="' + escHtml(tool.description || '') + '"></div>' +
      '<div class="form-group"><label>命令（管理员可见）</label><input type="text" id="toolCommand" value="' + escHtml(tool.command || '') + '"></div>' +
      '<div class="form-group"><label>官网链接（无安装包时用户可跳转官网）</label><input type="text" id="toolLink" value="' + escHtml(tool.link || '') + '"></div>' +
      pkgInfo +
      '<div class="form-group"><label>' + (tool.package_name ? '替换安装包' : '上传安装包') + '（可选）</label><input type="file" id="toolPackage" accept=".exe,.msi,.deb,.rpm,.zip,.tar.gz,.7z,.dmg,.pkg"></div>' +
      '<div id="packageUploadStatus" style="font-size:12px;color:var(--text-muted);margin-top:-8px;"></div>' +
      '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveToolBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';

    showModal('编辑工具', bodyHtml);
    initIconSelector('toolIcon');

    $('#toolCategory').addEventListener('change', function() {
      $('#newCategoryGroup').style.display = this.value === '__new__' ? 'block' : 'none';
    });

    var delPkgBtn = $('#deletePackageBtn');
    if (delPkgBtn) {
      delPkgBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        if (!confirm('确定要删除当前安装包吗？删除后用户将跳转到官网下载。')) return;
        delPkgBtn.disabled = true;
        delPkgBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 删除中...';
        try {
          await apiFetch('/tools/' + tool.id + '/package', { method: 'DELETE' });
          toast('安装包已删除', 'success');
          closeModal();
          renderRoute('tools');
        } catch(err) {
          toast('删除失败: ' + err.message, 'error');
          delPkgBtn.disabled = false;
          delPkgBtn.innerHTML = '<i class="fa-solid fa-trash"></i> 删除';
        }
      });
    }

    $('#saveToolBtn').addEventListener('click', async function() {
      var category = $('#toolCategory').value;
      if (category === '__new__') {
        category = $('#toolNewCategory').value.trim();
        if (!category) { toast('请输入新分类名称', 'error'); return; }
      }
      var tagsStr = $('#toolTags').value.trim();
      var tags = tagsStr ? tagsStr.split(/[,，]/).map(function(t) { return t.trim(); }).filter(function(t) { return t; }) : [];
      var data = {
        name: $('#toolName').value.trim(),
        os: $('#toolOs').value,
        company_group: $('#toolCompanyGroup').value || 'general',
        category: category,
        tags: tags,
        icon: $('#toolIcon').value.trim(),
        description: $('#toolDesc').value.trim(),
        command: $('#toolCommand').value.trim(),
        link: $('#toolLink').value.trim()
      };
      if (!data.name) { toast('请填写工具名称', 'error'); return; }
      var pkgInput = $('#toolPackage');
      var pkgFile = pkgInput && pkgInput.files.length > 0 ? pkgInput.files[0] : null;
      
      var saveBtn = this;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
      
      try {
        await apiFetch('/tools/' + tool.id, { method: 'PUT', body: JSON.stringify(data) });
        if (pkgFile) {
          var statusEl = $('#packageUploadStatus');
          if (statusEl) statusEl.textContent = '正在上传安装包...';
          var formData = new FormData();
          formData.append('file', pkgFile);
          var token = appState.authToken;
          var uploadRes = await fetch(API_BASE + '/tools/' + tool.id + '/upload-package', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
          });
          if (!uploadRes.ok) {
            var errMsg = '安装包上传失败';
            try {
              var errData = await uploadRes.json();
              errMsg = errData.detail || errMsg;
            } catch(e) {}
            throw new Error(errMsg + ' (HTTP ' + uploadRes.status + ')');
          }
          if (statusEl) statusEl.textContent = '安装包上传成功';
        }
        toast('工具已更新', 'success');
        closeModal();
        renderRoute('tools');
      } catch(err) {
        toast('更新失败: ' + err.message, 'error');
        console.error('Edit tool error:', err);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> 保存';
      }
    });
  }

  var allToolboxTools = [
    { id: 'charcount', name: '字数/字符统计', icon: 'fa-solid fa-calculator', desc: '实时统计文本长度、段落数、中文字数', group: 'text' },
    { id: 'caseconv', name: '大小写转换', icon: 'fa-solid fa-font', desc: '转换为大写、小写、首字母大写、驼峰命名', group: 'text' },
    { id: 'linesort', name: '行排序/去重', icon: 'fa-solid fa-sort', desc: '按字母或数字排序文本行，去除重复行', group: 'text' },
    { id: 'findreplace', name: '文本查找替换', icon: 'fa-solid fa-magnifying-glass', desc: '批量查找替换指定字符串（支持正则）', group: 'text' },
    { id: 'reverse', name: '字符串反转/倒序', icon: 'fa-solid fa-rotate-left', desc: '反转字符顺序或单词顺序', group: 'text' },
    { id: 'diff', name: '文本差异对比', icon: 'fa-solid fa-code-compare', desc: '对比两段文本差异', group: 'text' },
    { id: 'json', name: 'JSON格式化', icon: 'fa-solid fa-code', desc: '格式化、校验JSON数据', group: 'code' },
    { id: 'sqlfmt', name: 'SQL 格式化', icon: 'fa-solid fa-database', desc: '格式化/压缩 SQL 查询语句', group: 'code' },
    { id: 'xmlfmt', name: 'XML 格式化', icon: 'fa-solid fa-file-code', desc: '美化或压缩 XML 数据', group: 'code' },
    { id: 'cssjsfmt', name: 'CSS/JS/HTML 格式化', icon: 'fa-brands fa-css3-alt', desc: '压缩或美化前端代码', group: 'code' },
    { id: 'yamlfmt', name: 'YAML 格式化', icon: 'fa-solid fa-file-lines', desc: '校验并美化 YAML 配置文件', group: 'code' },
    { id: 'markdown', name: 'Markdown预览', icon: 'fa-brands fa-markdown', desc: 'Markdown实时预览编辑器', group: 'code' },
    { id: 'urlcodec', name: 'URL编解码', icon: 'fa-solid fa-link', desc: 'URL编码与解码', group: 'crypto' },
    { id: 'base64', name: 'Base64编解码', icon: 'fa-solid fa-lock', desc: 'Base64编码与解码', group: 'crypto' },
    { id: 'htmlentity', name: 'HTML 实体编码/解码', icon: 'fa-solid fa-code', desc: '将特殊字符转为 HTML 实体或反向', group: 'crypto' },
    { id: 'jwt', name: 'JWT 调试工具', icon: 'fa-solid fa-shield-halved', desc: '解析、验证和生成 JWT Token', group: 'crypto' },
    { id: 'hash', name: 'MD5/SHA 哈希生成', icon: 'fa-solid fa-fingerprint', desc: '生成字符串或文件的哈希值', group: 'crypto' },
    { id: 'aes', name: 'AES 加解密', icon: 'fa-solid fa-key', desc: 'AES 对称加密在线测试', group: 'crypto' },
    { id: 'timestamp', name: '时间戳转换', icon: 'fa-solid fa-clock', desc: 'Unix时间戳与日期互转', group: 'convert' },
    { id: 'csvjson', name: 'CSV ↔ JSON 互转', icon: 'fa-solid fa-table', desc: '将表格数据转为 JSON 或反向', group: 'convert' },
    { id: 'xmljson', name: 'XML ↔ JSON 互转', icon: 'fa-solid fa-right-left', desc: '在两种数据格式间转换', group: 'convert' },
    { id: 'yamljson', name: 'YAML ↔ JSON 互转', icon: 'fa-solid fa-arrows-rotate', desc: '便于配置文件的格式迁移', group: 'convert' },
    { id: 'radix', name: '进制转换器', icon: 'fa-solid fa-hashtag', desc: '二进制、八进制、十进制、十六进制互转', group: 'convert' },
    { id: 'password', name: '密码生成器', icon: 'fa-solid fa-key', desc: '随机密码生成', group: 'generator' },
    { id: 'uuid', name: 'UUID/GUID 生成器', icon: 'fa-solid fa-barcode', desc: '批量生成全局唯一标识符', group: 'generator' },
    { id: 'random', name: '随机数生成器', icon: 'fa-solid fa-dice', desc: '指定范围生成随机整数/浮点数', group: 'generator' },
    { id: 'qrcode', name: '二维码生成器', icon: 'fa-solid fa-qrcode', desc: '输入文本/链接生成可下载的二维码图片', group: 'generator' },
    { id: 'placeholder', name: '占位图生成器', icon: 'fa-solid fa-image', desc: '按尺寸生成纯色占位图片 URL', group: 'generator' },
    { id: 'fakedata', name: '假数据生成器', icon: 'fa-solid fa-user-secret', desc: '生成模拟姓名、手机号、邮箱等测试数据', group: 'generator' },
    { id: 'ipinfo', name: 'IP信息查询', icon: 'fa-solid fa-globe', desc: '查询IP地址归属信息', group: 'network' },
    { id: 'sslcheck', name: 'SSL 证书检测', icon: 'fa-solid fa-certificate', desc: '查看网站证书有效期及详细信息', group: 'network' },
    { id: 'dnslookup', name: 'DNS 查询工具', icon: 'fa-solid fa-network-wired', desc: '查询域名的 A、MX、CNAME 等解析记录', group: 'network' },
    { id: 'httpstatus', name: 'HTTP 状态码检测', icon: 'fa-solid fa-signal', desc: '检测 URL 的响应状态码和头信息', group: 'network' },
    { id: 'portscan', name: '端口扫描器', icon: 'fa-solid fa-tower-broadcast', desc: '在线检测指定 IP 的端口开放情况', group: 'network' },
    { id: 'color', name: '颜色选择器', icon: 'fa-solid fa-palette', desc: 'HEX/RGB/HSL颜色转换', group: 'image' },
    { id: 'imgbase64', name: '图片转 Base64', icon: 'fa-solid fa-file-image', desc: '将小图片转为 Base64 字符串', group: 'image' },
    { id: 'iconpreview', name: '图标字体预览', icon: 'fa-brands fa-font-awesome', desc: '搜索/预览 Font Awesome 图标库', group: 'image' },
    { id: 'palette', name: '调色板生成器', icon: 'fa-solid fa-swatchbook', desc: '根据主色生成配套配色方案', group: 'image' },
    { id: 'imgcompress', name: '图片压缩工具', icon: 'fa-solid fa-compress', desc: '在线压缩 JPG/PNG 图片大小', group: 'image' },
    { id: 'svg2ico', name: 'SVG转ICO图标', icon: 'fa-solid fa-image', desc: '将SVG矢量图转换为ICO格式图标', group: 'image' },
    { id: 'unitconv', name: '单位换算', icon: 'fa-solid fa-ruler', desc: '长度、重量、温度、面积、体积等', group: 'math' },
    { id: 'calculator', name: '计算器', icon: 'fa-solid fa-calculator', desc: '带进制运算的高级计算器', group: 'math' },
    { id: 'percent', name: '百分比计算器', icon: 'fa-solid fa-percent', desc: '增减比例、占比计算', group: 'math' },
    { id: 'regex', name: '正则测试器', icon: 'fa-solid fa-magnifying-glass', desc: '正则表达式在线测试', group: 'misc' },
    { id: 'cron', name: 'Cron 表达式生成器', icon: 'fa-solid fa-clock', desc: '可视化生成定时任务规则', group: 'misc' },
    { id: 'regexlib', name: '正则表达式库', icon: 'fa-solid fa-book', desc: '提供常用正则（手机号、邮箱等）并测试', group: 'misc' },
    { id: 'chmodcalc', name: 'Unix 权限计算器', icon: 'fa-solid fa-terminal', desc: '数字与符号权限互转', group: 'misc' },
    { id: 'mime', name: 'MIME 类型查询', icon: 'fa-solid fa-file', desc: '根据文件扩展名查 Content-Type', group: 'misc' }
  ];

  function renderToolbox(content) {
    loadAllData().then(function() {
      var d = appState.data;
      var groups = d.toolboxGroups && d.toolboxGroups.length > 0 ? d.toolboxGroups.filter(function(g) { return g.visible !== false; }) : [];
      groups.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      var favToolbox = d.favorites.toolbox || [];

      var html = '<h2 class="page-title">🧰 工具箱</h2>';
      if (groups.length > 0) {
        groups.forEach(function(g) {
          var groupTools = allToolboxTools.filter(function(t) { return t.group === g.id; });
          if (groupTools.length === 0) return;
          html += '<div class="toolbox-group-section" data-group-id="' + escHtml(g.id) + '">' +
            '<h3 class="toolbox-group-title">' + escHtml(g.name) + '</h3>' +
            '<div class="toolbox-grid">' +
            groupTools.map(function(t) {
              var isFav = favToolbox.indexOf(t.id) !== -1;
              return '<div class="toolbox-card" data-tool="' + t.id + '">' +
                '<button class="toolbox-fav-btn' + (isFav ? ' active' : '') + '" data-fav-type="toolbox" data-fav-id="' + t.id + '" title="收藏"><i class="fa-solid fa-star"></i></button>' +
                '<div class="tb-icon"><i class="' + t.icon + '"></i></div>' +
                '<div class="tb-name">' + t.name + '</div>' +
                '<div class="tb-desc">' + t.desc + '</div>' +
              '</div>';
            }).join('') +
            '</div></div>';
        });
      } else {
        html += '<div class="toolbox-grid">' +
          allToolboxTools.map(function(t) {
            var isFav = favToolbox.indexOf(t.id) !== -1;
            return '<div class="toolbox-card" data-tool="' + t.id + '">' +
              '<button class="toolbox-fav-btn' + (isFav ? ' active' : '') + '" data-fav-type="toolbox" data-fav-id="' + t.id + '" title="收藏"><i class="fa-solid fa-star"></i></button>' +
              '<div class="tb-icon"><i class="' + t.icon + '"></i></div>' +
              '<div class="tb-name">' + t.name + '</div>' +
              '<div class="tb-desc">' + t.desc + '</div>' +
            '</div>';
          }).join('') +
        '</div>';
      }
      content.innerHTML = html;
      $$('.toolbox-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.toolbox-fav-btn')) return;
          openToolboxTool(card.dataset.tool);
        });
      });
      $$('.toolbox-fav-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleFavorite(btn.dataset.favType, btn.dataset.favId, btn);
        });
      });
    });
  }

  function openToolboxTool(toolId) {
    var title = '', bodyHtml = '';
    switch (toolId) {
      case 'charcount':
        title = '字数/字符统计';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="ccInput" placeholder="输入或粘贴文本..." style="height:150px;"></textarea>' +
          '<div class="toolbox-tool-output" id="ccOutput" style="margin-top:12px;"></div>';
        break;
      case 'caseconv':
        title = '大小写转换';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="caseInput" placeholder="输入文本..." style="height:120px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="caseUpper">全大写</button>' +
          '<button class="btn" id="caseLower">全小写</button>' +
          '<button class="btn" id="caseCapitalize">首字母大写</button>' +
          '<button class="btn" id="caseCamel">驼峰命名</button>' +
          '<button class="btn" id="caseSnake">蛇形命名</button>' +
          '</div><div class="toolbox-tool-output" id="caseOutput"></div>';
        break;
      case 'linesort':
        title = '行排序/去重';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="lsInput" placeholder="每行一条文本..." style="height:150px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="lsSortAsc">A→Z</button>' +
          '<button class="btn" id="lsSortDesc">Z→A</button>' +
          '<button class="btn" id="lsSortNum">数字排序</button>' +
          '<button class="btn" id="lsDedup">去重</button>' +
          '<button class="btn" id="lsSortDedup">排序+去重</button>' +
          '</div><div class="toolbox-tool-output" id="lsOutput"></div>';
        break;
      case 'findreplace':
        title = '文本查找替换';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="frInput" placeholder="输入文本..." style="height:120px;"></textarea>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">查找:</label><input type="text" id="frFind" placeholder="查找内容"></div>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">替换:</label><input type="text" id="frReplace" placeholder="替换为"></div>' +
          '<div class="toolbox-tool-row"><label style="font-size:13px;"><input type="checkbox" id="frRegex"> 正则</label> <label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="frCase"> 区分大小写</label></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="frRun"><i class="fa-solid fa-play"></i> 替换</button></div>' +
          '<div class="toolbox-tool-output" id="frOutput"></div>';
        break;
      case 'reverse':
        title = '字符串反转/倒序';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="revInput" placeholder="输入文本..." style="height:120px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="revChars">字符反转</button>' +
          '<button class="btn" id="revWords">单词反转</button>' +
          '<button class="btn" id="revLines">行反转</button>' +
          '</div><div class="toolbox-tool-output" id="revOutput"></div>';
        break;
      case 'diff':
        title = '文本差异对比';
        bodyHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
          '<div><label style="font-size:13px;font-weight:600;margin-bottom:8px;display:block;">源文本</label><textarea class="toolbox-tool-textarea" id="diffOld" placeholder="原始文本..." style="height:200px;"></textarea></div>' +
          '<div><label style="font-size:13px;font-weight:600;margin-bottom:8px;display:block;">目标文本</label><textarea class="toolbox-tool-textarea" id="diffNew" placeholder="新文本..." style="height:200px;"></textarea></div></div>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;"><button class="btn btn-primary" id="diffCompare"><i class="fa-solid fa-code-compare"></i> 对比</button></div>' +
          '<div class="toolbox-tool-output" id="diffOutput"></div>';
        break;
      case 'json':
        title = 'JSON格式化 & 校验';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="jsonInput" placeholder="粘贴JSON数据..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="jsonFormat"><i class="fa-solid fa-align-left"></i> 格式化</button>' +
          '<button class="btn" id="jsonMinify"><i class="fa-solid fa-compress"></i> 压缩</button>' +
          '<button class="btn" id="jsonValidate"><i class="fa-solid fa-check-circle"></i> 校验</button>' +
          '</div><div class="toolbox-tool-output" id="jsonOutput"></div>';
        break;
      case 'sqlfmt':
        title = 'SQL 格式化';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="sqlInput" placeholder="输入SQL语句..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="sqlFormat"><i class="fa-solid fa-align-left"></i> 格式化</button>' +
          '<button class="btn" id="sqlMinify"><i class="fa-solid fa-compress"></i> 压缩</button>' +
          '</div><div class="toolbox-tool-output" id="sqlOutput"></div>';
        break;
      case 'xmlfmt':
        title = 'XML 格式化';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="xmlInput" placeholder="输入XML数据..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="xmlFormat"><i class="fa-solid fa-align-left"></i> 格式化</button>' +
          '<button class="btn" id="xmlMinify"><i class="fa-solid fa-compress"></i> 压缩</button>' +
          '</div><div class="toolbox-tool-output" id="xmlOutput"></div>';
        break;
      case 'cssjsfmt':
        title = 'CSS/JS/HTML 格式化';
        bodyHtml = '<div class="toolbox-tool-row"><select id="codeType" style="padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-primary);"><option value="css">CSS</option><option value="js">JavaScript</option><option value="html">HTML</option></select></div>' +
          '<textarea class="toolbox-tool-textarea" id="codeInput" placeholder="输入代码..." style="height:200px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="codeFormat"><i class="fa-solid fa-align-left"></i> 格式化</button>' +
          '<button class="btn" id="codeMinify"><i class="fa-solid fa-compress"></i> 压缩</button>' +
          '</div><div class="toolbox-tool-output" id="codeOutput"></div>';
        break;
      case 'yamlfmt':
        title = 'YAML 格式化';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="yamlInput" placeholder="输入YAML数据..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="yamlValidate"><i class="fa-solid fa-check-circle"></i> 校验</button>' +
          '<button class="btn" id="yamlToJson"><i class="fa-solid fa-right-left"></i> 转JSON</button>' +
          '</div><div class="toolbox-tool-output" id="yamlOutput"></div>';
        break;
      case 'markdown':
        title = 'Markdown实时预览';
        bodyHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
          '<div><label style="font-size:13px;font-weight:600;margin-bottom:8px;display:block;">编辑器</label><textarea class="toolbox-tool-textarea" id="mdInput" placeholder="输入 Markdown..." style="height:350px;"># Hello Markdown\n\n**粗体** *斜体*\n\n- 列表项1\n- 列表项2\n\n`行内代码`</textarea></div>' +
          '<div><label style="font-size:13px;font-weight:600;margin-bottom:8px;display:block;">预览</label><div id="mdPreview" style="border:1px solid var(--border-color);border-radius:var(--radius);padding:16px;height:350px;overflow-y:auto;background:var(--bg-color);"></div></div></div>';
        break;
      case 'urlcodec':
        title = 'URL编码/解码';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="urlInput" placeholder="输入URL或文本..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="urlEncode"><i class="fa-solid fa-lock"></i> 编码</button>' +
          '<button class="btn" id="urlDecode"><i class="fa-solid fa-unlock"></i> 解码</button></div>' +
          '<div class="toolbox-tool-output" id="urlOutput"></div>';
        break;
      case 'base64':
        title = 'Base64编码/解码';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="b64Input" placeholder="输入文本..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="b64Encode"><i class="fa-solid fa-lock"></i> 编码</button>' +
          '<button class="btn" id="b64Decode"><i class="fa-solid fa-unlock"></i> 解码</button></div>' +
          '<div class="toolbox-tool-output" id="b64Output"></div>';
        break;
      case 'htmlentity':
        title = 'HTML 实体编码/解码';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="heInput" placeholder="输入文本或HTML实体..." style="height:120px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="heEncode">编码</button>' +
          '<button class="btn" id="heDecode">解码</button></div>' +
          '<div class="toolbox-tool-output" id="heOutput"></div>';
        break;
      case 'jwt':
        title = 'JWT 调试工具';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="jwtInput" placeholder="粘贴JWT Token..." style="height:100px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;"><button class="btn btn-primary" id="jwtDecode"><i class="fa-solid fa-play"></i> 解析</button></div>' +
          '<div class="toolbox-tool-output" id="jwtOutput"></div>';
        break;
      case 'hash':
        title = 'MD5/SHA 哈希生成';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="hashInput" placeholder="输入文本..." style="height:80px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="hashMd5">MD5</button>' +
          '<button class="btn" id="hashSha1">SHA-1</button>' +
          '<button class="btn" id="hashSha256">SHA-256</button></div>' +
          '<div class="toolbox-tool-output" id="hashOutput"></div>';
        break;
      case 'aes':
        title = 'AES 加解密';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="aesInput" placeholder="输入文本..." style="height:80px;"></textarea>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">密钥:</label><input type="text" id="aesKey" placeholder="16/24/32字节密钥"></div>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="aesEncrypt">加密</button>' +
          '<button class="btn" id="aesDecrypt">解密</button></div>' +
          '<div class="toolbox-tool-output" id="aesOutput"></div>';
        break;
      case 'timestamp':
        title = '时间戳转换';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">时间戳(秒):</label><input type="number" id="tsInput" placeholder="输入Unix时间戳"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="tsToDate"><i class="fa-solid fa-arrow-right"></i> 转换为日期</button><button class="btn" id="tsNow"><i class="fa-solid fa-clock"></i> 当前时间戳</button></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">日期时间:</label><input type="text" id="dateInput" placeholder="如 2026-06-20 12:00:00"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="dateToTs"><i class="fa-solid fa-arrow-left"></i> 转换为时间戳</button></div>' +
          '<div class="toolbox-tool-output" id="tsOutput"></div>';
        break;
      case 'csvjson':
        title = 'CSV ↔ JSON 互转';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="cjInput" placeholder="输入CSV或JSON..." style="height:150px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="csv2json">CSV → JSON</button>' +
          '<button class="btn" id="json2csv">JSON → CSV</button></div>' +
          '<div class="toolbox-tool-output" id="cjOutput"></div>';
        break;
      case 'xmljson':
        title = 'XML ↔ JSON 互转';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="xjInput" placeholder="输入XML或JSON..." style="height:150px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="xml2json">XML → JSON</button>' +
          '<button class="btn" id="json2xml">JSON → XML</button></div>' +
          '<div class="toolbox-tool-output" id="xjOutput"></div>';
        break;
      case 'yamljson':
        title = 'YAML ↔ JSON 互转';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="yjInput" placeholder="输入YAML或JSON..." style="height:150px;"></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;">' +
          '<button class="btn btn-primary" id="yaml2json">YAML → JSON</button>' +
          '<button class="btn" id="json2yaml">JSON → YAML</button></div>' +
          '<div class="toolbox-tool-output" id="yjOutput"></div>';
        break;
      case 'radix':
        title = '进制转换器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">输入值:</label><input type="text" id="radixInput" placeholder="输入数字"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">输入进制:</label><select id="radixFrom" style="padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-primary);"><option value="2">二进制</option><option value="8">八进制</option><option value="10" selected>十进制</option><option value="16">十六进制</option></select></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="radixConvert">转换</button></div>' +
          '<div class="toolbox-tool-output" id="radixOutput"></div>';
        break;
      case 'password':
        title = '随机密码生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">长度:</label><input type="number" id="pwLength" value="16" min="4" max="128"></div>' +
          '<div class="toolbox-tool-row">' +
          '<label style="font-size:13px;"><input type="checkbox" id="pwUpper" checked> 大写</label>' +
          '<label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="pwLower" checked> 小写</label>' +
          '<label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="pwDigits" checked> 数字</label>' +
          '<label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="pwSymbols" checked> 符号</label></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="pwGenerate"><i class="fa-solid fa-rotate"></i> 生成密码</button></div>' +
          '<div class="toolbox-tool-output" id="pwOutput" style="font-size:18px;text-align:center;letter-spacing:2px;"></div>';
        break;
      case 'uuid':
        title = 'UUID/GUID 生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">数量:</label><input type="number" id="uuidCount" value="5" min="1" max="100"></div>' +
          '<div class="toolbox-tool-row"><label style="font-size:13px;"><input type="checkbox" id="uuidUpper"> 大写</label> <label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="uuidNoDash"> 无连字符</label></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="uuidGen"><i class="fa-solid fa-rotate"></i> 生成</button></div>' +
          '<div class="toolbox-tool-output" id="uuidOutput"></div>';
        break;
      case 'random':
        title = '随机数生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">最小值:</label><input type="number" id="randMin" value="1"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">最大值:</label><input type="number" id="randMax" value="100"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">数量:</label><input type="number" id="randCount" value="1" min="1" max="100"></div>' +
          '<div class="toolbox-tool-row"><label style="font-size:13px;"><input type="checkbox" id="randFloat"> 浮点数</label></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="randGen"><i class="fa-solid fa-dice"></i> 生成</button></div>' +
          '<div class="toolbox-tool-output" id="randOutput"></div>';
        break;
      case 'qrcode':
        title = '二维码生成器';
        bodyHtml = '<textarea class="toolbox-tool-textarea" id="qrInput" placeholder="输入文本或链接..." style="height:80px;"></textarea>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">大小:</label><input type="number" id="qrSize" value="200" min="50" max="500"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="qrGen"><i class="fa-solid fa-qrcode"></i> 生成</button></div>' +
          '<div style="text-align:center;margin-top:12px;"><img id="qrImg" style="display:none;max-width:300px;"></div>';
        break;
      case 'placeholder':
        title = '占位图生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">宽度:</label><input type="number" id="phW" value="300" min="10" max="2000"> <label style="width:60px;font-size:13px;margin-left:12px;">高度:</label><input type="number" id="phH" value="200" min="10" max="2000"></div>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">背景色:</label><input type="color" id="phBg" value="#cccccc"> <label style="width:60px;font-size:13px;margin-left:12px;">文字色:</label><input type="color" id="phFg" value="#333333"></div>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">文字:</label><input type="text" id="phText" value="" placeholder="默认显示尺寸"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="phGen">生成</button></div>' +
          '<div class="toolbox-tool-output" id="phOutput"></div>' +
          '<div style="text-align:center;margin-top:12px;"><canvas id="phCanvas" style="display:none;max-width:100%;"></canvas></div>';
        break;
      case 'fakedata':
        title = '假数据生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">数量:</label><input type="number" id="fdCount" value="5" min="1" max="50"></div>' +
          '<div class="toolbox-tool-row"><label style="font-size:13px;"><input type="checkbox" id="fdName" checked> 姓名</label> <label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="fdPhone" checked> 手机号</label> <label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="fdEmail" checked> 邮箱</label> <label style="font-size:13px;margin-left:12px;"><input type="checkbox" id="fdAddr" checked> 地址</label></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="fdGen"><i class="fa-solid fa-rotate"></i> 生成</button></div>' +
          '<div class="toolbox-tool-output" id="fdOutput"></div>';
        break;
      case 'ipinfo':
        title = 'IP信息查询';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">IP地址:</label><input type="text" id="ipInfoInput" placeholder="输入IP地址，留空查询本机"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="ipInfoQuery"><i class="fa-solid fa-search"></i> 查询</button></div>' +
          '<div class="toolbox-tool-output" id="ipInfoOutput"></div>';
        break;
      case 'sslcheck':
        title = 'SSL 证书检测';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">域名:</label><input type="text" id="sslDomain" placeholder="如 example.com"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="sslCheck"><i class="fa-solid fa-search"></i> 检测</button></div>' +
          '<div class="toolbox-tool-output" id="sslOutput"></div>';
        break;
      case 'dnslookup':
        title = 'DNS 查询工具';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">域名:</label><input type="text" id="dnsDomain" placeholder="如 example.com"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">类型:</label><select id="dnsType" style="padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-primary);"><option value="A">A</option><option value="AAAA">AAAA</option><option value="CNAME">CNAME</option><option value="MX">MX</option></select></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="dnsQuery"><i class="fa-solid fa-search"></i> 查询</button></div>' +
          '<div class="toolbox-tool-output" id="dnsOutput"></div>';
        break;
      case 'httpstatus':
        title = 'HTTP 状态码检测';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">URL:</label><input type="text" id="httpUrl" placeholder="如 https://example.com"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="httpCheck"><i class="fa-solid fa-search"></i> 检测</button></div>' +
          '<div class="toolbox-tool-output" id="httpOutput"></div>';
        break;
      case 'portscan':
        title = '端口扫描器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">主机:</label><input type="text" id="psHost" placeholder="如 192.168.9.150"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">端口:</label><input type="text" id="psPorts" placeholder="如 22,80,443,3306,8080"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="psScan"><i class="fa-solid fa-search"></i> 扫描</button></div>' +
          '<div class="toolbox-tool-output" id="psOutput"></div>';
        break;
      case 'color':
        title = '颜色选择器 & 转换';
        bodyHtml = '<div class="toolbox-tool-row"><input type="color" id="colorPicker" value="#4f46e5"><div class="color-preview" id="colorPreview" style="background:#4f46e5;"></div></div>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">HEX:</label><input type="text" id="hexInput" value="#4f46e5"></div>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">RGB:</label><input type="text" id="rgbInput" value="rgb(79,70,229)"></div>' +
          '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">HSL:</label><input type="text" id="hslInput" value=""></div>';
        break;
      case 'imgbase64':
        title = '图片转 Base64';
        bodyHtml = '<div class="toolbox-tool-row"><input type="file" id="imgB64File" accept="image/*"></div>' +
          '<div class="toolbox-tool-output" id="imgB64Output" style="max-height:200px;overflow:auto;word-break:break-all;font-size:12px;"></div>' +
          '<div style="text-align:center;margin-top:8px;"><img id="imgB64Preview" style="max-width:200px;max-height:200px;display:none;"></div>';
        break;
      case 'iconpreview':
        title = '图标字体预览';
        bodyHtml = '<div class="toolbox-tool-row"><input type="text" id="iconSearch" placeholder="搜索图标名称..." style="width:100%;"></div>' +
          '<div id="iconGrid" style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-top:12px;max-height:300px;overflow-y:auto;"></div>' +
          '<div class="toolbox-tool-output" id="iconOutput"></div>';
        break;
      case 'palette':
        title = '调色板生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">主色:</label><input type="color" id="palBase" value="#4f46e5"> <button class="btn btn-primary" id="palGen" style="margin-left:12px;">生成</button></div>' +
          '<div id="palResult" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;"></div>';
        break;
      case 'imgcompress':
        title = '图片压缩工具';
        bodyHtml = '<div class="toolbox-tool-row"><input type="file" id="imgCompFile" accept="image/jpeg,image/png"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">质量:</label><input type="range" id="imgCompQuality" min="10" max="100" value="70" style="flex:1;"> <span id="imgCompQVal" style="margin-left:8px;">70%</span></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="imgCompRun">压缩</button></div>' +
          '<div class="toolbox-tool-output" id="imgCompOutput"></div>' +
          '<div style="text-align:center;margin-top:8px;"><canvas id="imgCompCanvas" style="display:none;max-width:100%;"></canvas></div>';
        break;
      case 'unitconv':
        title = '单位换算';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">类别:</label><select id="unitType" style="padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-primary);"><option value="length">长度</option><option value="weight">重量</option><option value="temp">温度</option><option value="area">面积</option><option value="volume">体积</option></select></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">数值:</label><input type="number" id="unitVal" value="1"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">从:</label><select id="unitFrom" style="padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-primary);"></select></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">到:</label><select id="unitTo" style="padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-color);color:var(--text-primary);"></select></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="unitConv">换算</button></div>' +
          '<div class="toolbox-tool-output" id="unitOutput"></div>';
        break;
      case 'calculator':
        title = '计算器';
        bodyHtml = '<div class="toolbox-tool-row"><input type="text" id="calcInput" placeholder="输入表达式，如 2+3*4" style="width:100%;font-size:20px;font-family:monospace;"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="calcEval">计算</button> <button class="btn" id="calcClear">清空</button></div>' +
          '<div class="toolbox-tool-output" id="calcOutput" style="font-size:24px;text-align:center;"></div>';
        break;
      case 'percent':
        title = '百分比计算器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:100px;font-size:13px;">X 是 Y 的%</label><input type="number" id="pctX" placeholder="X"> <input type="number" id="pctY" placeholder="Y"> <button class="btn btn-primary" id="pctCalc1">计算</button></div>' +
          '<div class="toolbox-tool-row"><label style="width:100px;font-size:13px;">X 的 Y%</label><input type="number" id="pctA" placeholder="X"> <input type="number" id="pctB" placeholder="Y%"> <button class="btn btn-primary" id="pctCalc2">计算</button></div>' +
          '<div class="toolbox-tool-row"><label style="width:100px;font-size:13px;">增减百分比</label><input type="number" id="pctOld" placeholder="原值"> <input type="number" id="pctNew" placeholder="新值"> <button class="btn btn-primary" id="pctCalc3">计算</button></div>' +
          '<div class="toolbox-tool-output" id="pctOutput"></div>';
        break;
      case 'regex':
        title = '正则表达式测试器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">正则:</label><input type="text" id="regexPattern" placeholder="/pattern/flags"></div>' +
          '<textarea class="toolbox-tool-textarea" id="regexInput" placeholder="输入测试文本..."></textarea>' +
          '<div class="toolbox-tool-row" style="margin-top:12px;"><button class="btn btn-primary" id="regexTest"><i class="fa-solid fa-play"></i> 测试</button></div>' +
          '<div class="toolbox-tool-output" id="regexOutput"></div>';
        break;
      case 'cron':
        title = 'Cron 表达式生成器';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:60px;font-size:13px;">分:</label><input type="text" id="cronMin" value="0" style="width:60px;"> <label style="width:40px;font-size:13px;">时:</label><input type="text" id="cronHour" value="*" style="width:60px;"> <label style="width:40px;font-size:13px;">日:</label><input type="text" id="cronDay" value="*" style="width:60px;"> <label style="width:40px;font-size:13px;">月:</label><input type="text" id="cronMon" value="*" style="width:60px;"> <label style="width:40px;font-size:13px;">周:</label><input type="text" id="cronWeek" value="*" style="width:60px;"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="cronGen">生成表达式</button> <button class="btn" id="cronParse">解析表达式</button></div>' +
          '<div class="toolbox-tool-output" id="cronOutput"></div>';
        break;
      case 'regexlib':
        title = '正则表达式库';
        bodyHtml = '<div id="regexLibList" style="max-height:300px;overflow-y:auto;"></div>' +
          '<div class="toolbox-tool-output" id="regexLibOutput"></div>';
        break;
      case 'chmodcalc':
        title = 'Unix 权限计算器 (chmod)';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">数字:</label><input type="text" id="chmodNum" placeholder="如 755" maxlength="4"></div>' +
          '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">符号:</label><input type="text" id="chmodSym" placeholder="如 rwxr-xr-x"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="chmodNum2Sym">数字→符号</button> <button class="btn" id="chmodSym2Num">符号→数字</button></div>' +
          '<div class="toolbox-tool-output" id="chmodOutput"></div>';
        break;
      case 'mime':
        title = 'MIME 类型查询';
        bodyHtml = '<div class="toolbox-tool-row"><label style="width:80px;font-size:13px;">扩展名:</label><input type="text" id="mimeExt" placeholder="如 .pdf"></div>' +
          '<div class="toolbox-tool-row"><button class="btn btn-primary" id="mimeQuery">查询</button></div>' +
          '<div class="toolbox-tool-output" id="mimeOutput"></div>';
        break;
      case 'svg2ico':
        title = 'SVG转ICO图标';
        bodyHtml = '<div style="text-align:center;padding:20px;"><p style="color:var(--text-secondary);margin-bottom:16px;">将SVG矢量图转换为ICO格式图标</p>' +
          '<a href="https://svg2ico.com/convert" target="_blank" class="btn btn-primary" style="font-size:16px;padding:12px 32px;"><i class="fa-solid fa-external-link"></i> 打开转换工具</a>' +
          '<p style="color:var(--text-muted);font-size:12px;margin-top:12px;">跳转到 svg2ico.com 进行在线转换</p></div>';
        break;
      default:
        title = '工具';
        bodyHtml = '<p>工具加载中...</p>';
    }
    showModal(title, bodyHtml);
    bindToolboxToolEvents(toolId);
  }

  function bindToolboxToolEvents(toolId) {
    function apiPost(url, body, outputId) {
      var el = $('#' + outputId);
      el.textContent = '处理中...';
      var headers = { 'Content-Type': 'application/json' };
      if (appState.authToken) { headers['Authorization'] = 'Bearer ' + appState.authToken; }
      fetch(API_BASE + url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
        .then(function(r) { return r.json(); })
        .then(function(d) { el.textContent = typeof d === 'string' ? d : JSON.stringify(d, null, 2); })
        .catch(function(e) { el.textContent = '错误: ' + e.message; });
    }
    switch (toolId) {
      case 'charcount':
        var ccInput = $('#ccInput');
        function ccUpdate() {
          var t = ccInput.value;
          var chars = t.length;
          var cnChars = (t.match(/[\u4e00-\u9fff]/g) || []).length;
          var words = t.trim() ? t.trim().split(/\s+/).length : 0;
          var lines = t ? t.split('\n').length : 0;
          var paragraphs = t ? t.split(/\n\s*\n/).filter(function(p) { return p.trim(); }).length : 0;
          var bytes = new Blob([t]).size;
          $('#ccOutput').innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">' +
            '<div style="padding:8px;background:var(--bg-color);border-radius:var(--radius-sm);"><div style="font-size:20px;font-weight:700;">' + chars + '</div><div style="font-size:12px;color:var(--text-secondary);">字符数</div></div>' +
            '<div style="padding:8px;background:var(--bg-color);border-radius:var(--radius-sm);"><div style="font-size:20px;font-weight:700;">' + cnChars + '</div><div style="font-size:12px;color:var(--text-secondary);">中文字数</div></div>' +
            '<div style="padding:8px;background:var(--bg-color);border-radius:var(--radius-sm);"><div style="font-size:20px;font-weight:700;">' + words + '</div><div style="font-size:12px;color:var(--text-secondary);">单词数</div></div>' +
            '<div style="padding:8px;background:var(--bg-color);border-radius:var(--radius-sm);"><div style="font-size:20px;font-weight:700;">' + lines + '</div><div style="font-size:12px;color:var(--text-secondary);">行数</div></div>' +
            '<div style="padding:8px;background:var(--bg-color);border-radius:var(--radius-sm);"><div style="font-size:20px;font-weight:700;">' + paragraphs + '</div><div style="font-size:12px;color:var(--text-secondary);">段落数</div></div>' +
            '<div style="padding:8px;background:var(--bg-color);border-radius:var(--radius-sm);"><div style="font-size:20px;font-weight:700;">' + bytes + '</div><div style="font-size:12px;color:var(--text-secondary);">字节数</div></div></div>';
        }
        ccInput.addEventListener('input', ccUpdate);
        ccUpdate();
        break;
      case 'caseconv':
        $('#caseUpper').addEventListener('click', function() { $('#caseOutput').textContent = $('#caseInput').value.toUpperCase(); });
        $('#caseLower').addEventListener('click', function() { $('#caseOutput').textContent = $('#caseInput').value.toLowerCase(); });
        $('#caseCapitalize').addEventListener('click', function() { $('#caseOutput').textContent = $('#caseInput').value.replace(/\b\w/g, function(c) { return c.toUpperCase(); }); });
        $('#caseCamel').addEventListener('click', function() {
          var s = $('#caseInput').value.toLowerCase().replace(/[-_\s]+(.)/g, function(_, c) { return c.toUpperCase(); });
          $('#caseOutput').textContent = s.charAt(0).toLowerCase() + s.slice(1);
        });
        $('#caseSnake').addEventListener('click', function() {
          $('#caseOutput').textContent = $('#caseInput').value.replace(/\s+/g, '_').replace(/[A-Z]/g, function(c) { return '_' + c.toLowerCase(); }).replace(/^_/, '').replace(/__+/g, '_');
        });
        break;
      case 'linesort':
        $('#lsSortAsc').addEventListener('click', function() { $('#lsOutput').textContent = $('#lsInput').value.split('\n').sort().join('\n'); });
        $('#lsSortDesc').addEventListener('click', function() { $('#lsOutput').textContent = $('#lsInput').value.split('\n').sort().reverse().join('\n'); });
        $('#lsSortNum').addEventListener('click', function() { $('#lsOutput').textContent = $('#lsInput').value.split('\n').sort(function(a, b) { return parseFloat(a) - parseFloat(b); }).join('\n'); });
        $('#lsDedup').addEventListener('click', function() { var seen = {}; $('#lsOutput').textContent = $('#lsInput').value.split('\n').filter(function(l) { return seen.hasOwnProperty(l) ? false : (seen[l] = true); }).join('\n'); });
        $('#lsSortDedup').addEventListener('click', function() { var seen = {}; $('#lsOutput').textContent = $('#lsInput').value.split('\n').filter(function(l) { return seen.hasOwnProperty(l) ? false : (seen[l] = true); }).sort().join('\n'); });
        break;
      case 'findreplace':
        $('#frRun').addEventListener('click', function() {
          var text = $('#frInput').value, find = $('#frFind').value, repl = $('#frReplace').value;
          if (!find) { $('#frOutput').textContent = '请输入查找内容'; return; }
          try {
            if ($('#frRegex').checked) {
              var regex = new RegExp(find, $('#frCase').checked ? 'g' : 'gi');
              var count = 0;
              var result = text.replace(regex, function() { count++; return repl; });
              $('#frOutput').textContent = '替换 ' + count + ' 处\n\n' + result;
            } else {
              var count = text.split(find).length - 1;
              var result = text.split(find).join(repl);
              $('#frOutput').textContent = '替换 ' + count + ' 处\n\n' + result;
            }
          } catch(e) { $('#frOutput').textContent = '错误: ' + e.message; }
        });
        break;
      case 'reverse':
        $('#revChars').addEventListener('click', function() { $('#revOutput').textContent = $('#revInput').value.split('').reverse().join(''); });
        $('#revWords').addEventListener('click', function() { $('#revOutput').textContent = $('#revInput').value.split(/\s+/).reverse().join(' '); });
        $('#revLines').addEventListener('click', function() { $('#revOutput').textContent = $('#revInput').value.split('\n').reverse().join('\n'); });
        break;
      case 'diff':
        $('#diffCompare').addEventListener('click', function() {
          var oldText = $('#diffOld').value.split('\n');
          var newText = $('#diffNew').value.split('\n');
          var result = [];
          var i = 0, j = 0;
          while (i < oldText.length || j < newText.length) {
            if (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
              result.push(' ' + oldText[i]);
              i++; j++;
            } else if (j < newText.length && (i >= oldText.length || oldText.slice(i).indexOf(newText[j]) === -1)) {
              result.push('+' + newText[j]);
              j++;
            } else if (i < oldText.length) {
              result.push('-' + oldText[i]);
              i++;
            }
          }
          $('#diffOutput').innerHTML = result.map(function(line) {
            if (line.startsWith('+')) return '<span style="color:green;">' + escHtml(line) + '</span>';
            if (line.startsWith('-')) return '<span style="color:red;">' + escHtml(line) + '</span>';
            return '<span style="color:gray;">' + escHtml(line) + '</span>';
          }).join('<br>');
        });
        break;
      case 'json':
        $('#jsonFormat').addEventListener('click', function() {
          try { var obj = JSON.parse($('#jsonInput').value); $('#jsonOutput').textContent = JSON.stringify(obj, null, 2); $('#jsonOutput').style.color = 'var(--online-color)'; }
          catch(e) { $('#jsonOutput').textContent = 'JSON格式错误: ' + e.message; $('#jsonOutput').style.color = 'var(--offline-color)'; }
        });
        $('#jsonMinify').addEventListener('click', function() {
          try { var obj = JSON.parse($('#jsonInput').value); $('#jsonOutput').textContent = JSON.stringify(obj); }
          catch(e) { $('#jsonOutput').textContent = 'JSON格式错误: ' + e.message; }
        });
        $('#jsonValidate').addEventListener('click', function() {
          try { JSON.parse($('#jsonInput').value); $('#jsonOutput').textContent = '✓ JSON格式正确'; $('#jsonOutput').style.color = 'var(--online-color)'; }
          catch(e) { $('#jsonOutput').textContent = '✗ JSON格式错误: ' + e.message; $('#jsonOutput').style.color = 'var(--offline-color)'; }
        });
        break;
      case 'sqlfmt':
        $('#sqlFormat').addEventListener('click', function() {
          var sql = $('#sqlInput').value.trim();
          if (!sql) { $('#sqlOutput').textContent = '请输入SQL'; return; }
          sql = sql.replace(/\s+/g, ' ');
          var kw = ['SELECT','FROM','WHERE','AND','OR','ORDER BY','GROUP BY','HAVING','LIMIT','OFFSET','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','CREATE TABLE','ALTER TABLE','DROP TABLE','JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','ON','AS','IN','NOT','IS NULL','IS NOT NULL','LIKE','BETWEEN','UNION','UNION ALL','DISTINCT','ASC','DESC'];
          kw.forEach(function(k) { sql = sql.replace(new RegExp('\\b' + k.replace(/ /g, '\\s+') + '\\b', 'gi'), '\n' + k); });
          sql = sql.replace(/^\n+/, '').replace(/\n\s*\n/g, '\n');
          $('#sqlOutput').textContent = sql;
        });
        $('#sqlMinify').addEventListener('click', function() { $('#sqlOutput').textContent = $('#sqlInput').value.replace(/\s+/g, ' ').trim(); });
        break;
      case 'xmlfmt':
        $('#xmlFormat').addEventListener('click', function() {
          var xml = $('#xmlInput').value.trim();
          if (!xml) { $('#xmlOutput').textContent = '请输入XML'; return; }
          var indent = 0, formatted = '';
          xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/).filter(function(s) { return s.trim(); }).forEach(function(node) {
            if (node.match(/^<\//)) { indent = Math.max(0, indent - 1); formatted += '  '.repeat(indent) + node + '\n'; }
            else if (node.match(/^<[^/].*\/>$/)) { formatted += '  '.repeat(indent) + node + '\n'; }
            else if (node.match(/^</)) { formatted += '  '.repeat(indent) + node + '\n'; indent++; }
            else { formatted += '  '.repeat(indent) + node + '\n'; }
          });
          $('#xmlOutput').textContent = formatted.trim();
        });
        $('#xmlMinify').addEventListener('click', function() { $('#xmlOutput').textContent = $('#xmlInput').value.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim(); });
        break;
      case 'cssjsfmt':
        $('#codeFormat').addEventListener('click', function() {
          var code = $('#codeInput').value, type = $('#codeType').value;
          if (!code.trim()) { $('#codeOutput').textContent = '请输入代码'; return; }
          var result = code;
          if (type === 'css') {
            result = code.replace(/\s*{\s*/g, ' {\n  ').replace(/\s*}\s*/g, '\n}\n').replace(/;\s*/g, ';\n  ').replace(/\n\s*\n/g, '\n').replace(/  \n}/g, '\n}');
          } else if (type === 'html') {
            var indent = 0, lines = code.replace(/>\s*</g, '>\n<').split('\n');
            result = lines.map(function(line) {
              line = line.trim();
              if (line.match(/^<\//)) indent = Math.max(0, indent - 1);
              var r = '  '.repeat(indent) + line;
              if (line.match(/^<[^/!]/) && !line.match(/\/>$/)) indent++;
              return r;
            }).join('\n');
          } else {
            result = code.replace(/;\s*/g, ';\n').replace(/{\s*/g, '{\n  ').replace(/}\s*/g, '\n}\n');
          }
          $('#codeOutput').textContent = result;
        });
        $('#codeMinify').addEventListener('click', function() { $('#codeOutput').textContent = $('#codeInput').value.replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim(); });
        break;
      case 'yamlfmt':
        $('#yamlValidate').addEventListener('click', function() {
          var yaml = $('#yamlInput').value.trim();
          if (!yaml) { $('#yamlOutput').textContent = '请输入YAML'; return; }
          var lines = yaml.split('\n'), errors = [];
          lines.forEach(function(line, i) { if (line.match(/\t/)) errors.push('第' + (i+1) + '行: 包含Tab'); });
          $('#yamlOutput').textContent = errors.length ? '校验发现问题:\n' + errors.join('\n') : '✓ YAML格式基本正确';
        });
        $('#yamlToJson').addEventListener('click', function() { apiPost('/toolbox/yaml-to-json', { yaml: $('#yamlInput').value }, 'yamlOutput'); });
        break;
      case 'markdown':
        function renderMd() {
          var md = $('#mdInput').value;
          md = md.replace(/### (.+)/g, '<h3>$1</h3>').replace(/## (.+)/g, '<h2>$1</h2>').replace(/# (.+)/g, '<h1>$1</h1>');
          md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
          md = md.replace(/`([^`]+)`/g, '<code style="background:var(--bg-color);padding:2px 6px;border-radius:4px;">$1</code>');
          md = md.replace(/^- (.+)/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>').replace(/\n/g, '<br>');
          $('#mdPreview').innerHTML = md;
        }
        $('#mdInput').addEventListener('input', renderMd);
        renderMd();
        break;
      case 'urlcodec':
        $('#urlEncode').addEventListener('click', function() { $('#urlOutput').textContent = encodeURIComponent($('#urlInput').value); });
        $('#urlDecode').addEventListener('click', function() { try { $('#urlOutput').textContent = decodeURIComponent($('#urlInput').value); } catch(e) { $('#urlOutput').textContent = '解码失败: ' + e.message; } });
        break;
      case 'base64':
        $('#b64Encode').addEventListener('click', function() { try { $('#b64Output').textContent = btoa(unescape(encodeURIComponent($('#b64Input').value))); } catch(e) { $('#b64Output').textContent = '编码失败: ' + e.message; } });
        $('#b64Decode').addEventListener('click', function() { try { $('#b64Output').textContent = decodeURIComponent(escape(atob($('#b64Input').value))); } catch(e) { $('#b64Output').textContent = '解码失败: ' + e.message; } });
        break;
      case 'htmlentity':
        $('#heEncode').addEventListener('click', function() {
          $('#heOutput').textContent = $('#heInput').value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        });
        $('#heDecode').addEventListener('click', function() {
          var el = document.createElement('div'); el.innerHTML = $('#heInput').value;
          $('#heOutput').textContent = el.textContent;
        });
        break;
      case 'jwt':
        $('#jwtDecode').addEventListener('click', function() {
          try {
            var token = $('#jwtInput').value.trim();
            var parts = token.split('.');
            if (parts.length !== 3) { $('#jwtOutput').textContent = '无效的JWT格式'; return; }
            function b64UrlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
            var header = JSON.parse(b64UrlDecode(parts[0]));
            var payload = JSON.parse(b64UrlDecode(parts[1]));
            var result = '== Header ==\n' + JSON.stringify(header, null, 2) + '\n\n== Payload ==\n' + JSON.stringify(payload, null, 2);
            if (payload.exp) result += '\n\n过期时间: ' + new Date(payload.exp * 1000).toLocaleString('zh-CN') + (payload.exp * 1000 < Date.now() ? ' (已过期)' : ' (未过期)');
            if (payload.iat) result += '\n签发时间: ' + new Date(payload.iat * 1000).toLocaleString('zh-CN');
            $('#jwtOutput').textContent = result;
          } catch(e) { $('#jwtOutput').textContent = '解析失败: ' + e.message; }
        });
        break;
      case 'hash':
        $('#hashMd5').addEventListener('click', function() { apiPost('/toolbox/hash', { text: $('#hashInput').value, algo: 'md5' }, 'hashOutput'); });
        $('#hashSha1').addEventListener('click', function() { apiPost('/toolbox/hash', { text: $('#hashInput').value, algo: 'sha1' }, 'hashOutput'); });
        $('#hashSha256').addEventListener('click', function() { apiPost('/toolbox/hash', { text: $('#hashInput').value, algo: 'sha256' }, 'hashOutput'); });
        break;
      case 'aes':
        $('#aesEncrypt').addEventListener('click', function() { apiPost('/toolbox/aes-encrypt', { text: $('#aesInput').value, key: $('#aesKey').value }, 'aesOutput'); });
        $('#aesDecrypt').addEventListener('click', function() { apiPost('/toolbox/aes-decrypt', { text: $('#aesInput').value, key: $('#aesKey').value }, 'aesOutput'); });
        break;
      case 'timestamp':
        $('#tsToDate').addEventListener('click', function() {
          var ts = parseInt($('#tsInput').value);
          if (!ts) { $('#tsOutput').textContent = '请输入有效时间戳'; return; }
          var d = new Date(ts * 1000);
          $('#tsOutput').textContent = d.toLocaleString('zh-CN') + '\nISO: ' + d.toISOString();
        });
        $('#tsNow').addEventListener('click', function() { var ts = Math.floor(Date.now() / 1000); $('#tsInput').value = ts; $('#tsOutput').textContent = '当前时间戳: ' + ts; });
        $('#dateToTs').addEventListener('click', function() {
          var d = new Date($('#dateInput').value);
          if (isNaN(d.getTime())) { $('#tsOutput').textContent = '请输入有效日期'; return; }
          $('#tsOutput').textContent = '时间戳(秒): ' + Math.floor(d.getTime() / 1000);
        });
        break;
      case 'csvjson':
        $('#csv2json').addEventListener('click', function() {
          try {
            var csv = $('#cjInput').value.trim();
            if (!csv) { $('#cjOutput').textContent = '请输入CSV'; return; }
            var lines = csv.split('\n');
            var headers = lines[0].split(',').map(function(h) { return h.trim(); });
            var result = [];
            for (var i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              var vals = lines[i].split(',');
              var obj = {};
              headers.forEach(function(h, j) { obj[h] = (vals[j] || '').trim(); });
              result.push(obj);
            }
            $('#cjOutput').textContent = JSON.stringify(result, null, 2);
          } catch(e) { $('#cjOutput').textContent = '转换失败: ' + e.message; }
        });
        $('#json2csv').addEventListener('click', function() {
          try {
            var data = JSON.parse($('#cjInput').value);
            if (!Array.isArray(data) || data.length === 0) { $('#cjOutput').textContent = '请输入JSON数组'; return; }
            var headers = Object.keys(data[0]);
            var csv = headers.join(',') + '\n' + data.map(function(row) { return headers.map(function(h) { return row[h] || ''; }).join(','); }).join('\n');
            $('#cjOutput').textContent = csv;
          } catch(e) { $('#cjOutput').textContent = '转换失败: ' + e.message; }
        });
        break;
      case 'xmljson':
        $('#xml2json').addEventListener('click', function() { apiPost('/toolbox/xml-to-json', { xml: $('#xjInput').value }, 'xjOutput'); });
        $('#json2xml').addEventListener('click', function() { apiPost('/toolbox/json-to-xml', { json: $('#xjInput').value }, 'xjOutput'); });
        break;
      case 'yamljson':
        $('#yaml2json').addEventListener('click', function() { apiPost('/toolbox/yaml-to-json', { yaml: $('#yjInput').value }, 'yjOutput'); });
        $('#json2yaml').addEventListener('click', function() { apiPost('/toolbox/json-to-yaml', { json: $('#yjInput').value }, 'yjOutput'); });
        break;
      case 'radix':
        $('#radixConvert').addEventListener('click', function() {
          var val = $('#radixInput').value.trim();
          var from = parseInt($('#radixFrom').value);
          if (!val) { $('#radixOutput').textContent = '请输入数字'; return; }
          try {
            var num = parseInt(val, from);
            if (isNaN(num)) { $('#radixOutput').textContent = '无效数字'; return; }
            $('#radixOutput').textContent = '二进制: ' + num.toString(2) + '\n八进制: ' + num.toString(8) + '\n十进制: ' + num.toString(10) + '\n十六进制: ' + num.toString(16).toUpperCase();
          } catch(e) { $('#radixOutput').textContent = '转换失败: ' + e.message; }
        });
        break;
      case 'password':
        $('#pwGenerate').addEventListener('click', function() {
          var len = parseInt($('#pwLength').value) || 16;
          var chars = '';
          if ($('#pwUpper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          if ($('#pwLower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
          if ($('#pwDigits').checked) chars += '0123456789';
          if ($('#pwSymbols').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
          if (!chars) { $('#pwOutput').textContent = '请至少选择一种字符类型'; return; }
          var pw = '';
          for (var i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)];
          $('#pwOutput').textContent = pw;
        });
        $('#pwGenerate').click();
        break;
      case 'uuid':
        $('#uuidGen').addEventListener('click', function() {
          var count = parseInt($('#uuidCount').value) || 5;
          var upper = $('#uuidUpper').checked;
          var noDash = $('#uuidNoDash').checked;
          var results = [];
          for (var i = 0; i < count; i++) {
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              var r = Math.random() * 16 | 0;
              return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            if (noDash) uuid = uuid.replace(/-/g, '');
            if (upper) uuid = uuid.toUpperCase();
            results.push(uuid);
          }
          $('#uuidOutput').textContent = results.join('\n');
        });
        $('#uuidGen').click();
        break;
      case 'random':
        $('#randGen').addEventListener('click', function() {
          var min = parseFloat($('#randMin').value) || 0;
          var max = parseFloat($('#randMax').value) || 100;
          var count = parseInt($('#randCount').value) || 1;
          var isFloat = $('#randFloat').checked;
          var results = [];
          for (var i = 0; i < count; i++) {
            var r = Math.random() * (max - min) + min;
            results.push(isFloat ? r.toFixed(4) : Math.floor(r));
          }
          $('#randOutput').textContent = results.join(', ');
        });
        break;
      case 'qrcode':
        $('#qrGen').addEventListener('click', function() {
          var text = $('#qrInput').value.trim();
          if (!text) return;
          var size = parseInt($('#qrSize').value) || 200;
          var img = $('#qrImg');
          img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text);
          img.style.display = 'inline-block';
        });
        break;
      case 'placeholder':
        $('#phGen').addEventListener('click', function() {
          var w = parseInt($('#phW').value) || 300;
          var h = parseInt($('#phH').value) || 200;
          var bg = $('#phBg').value;
          var fg = $('#phFg').value;
          var text = $('#phText').value || w + 'x' + h;
          var canvas = $('#phCanvas');
          canvas.width = w; canvas.height = h;
          canvas.style.display = 'inline-block';
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = fg; ctx.font = Math.max(12, Math.min(w, h) / 8) + 'px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(text, w / 2, h / 2);
          $('#phOutput').textContent = '占位图 ' + w + 'x' + h + ' 已生成';
        });
        break;
      case 'fakedata':
        var fdSurnames = ['张','李','王','刘','陈','杨','赵','黄','周','吴','徐','孙','马','朱','胡','林','郭','何','罗','高'];
        var fdNames = ['伟','芳','秀英','敏','静','丽','强','磊','洋','勇','军','杰','涛','明','超','霞','平','刚','桂英'];
        var fdDomains = ['qq.com','163.com','gmail.com','outlook.com','foxmail.com'];
        var fdCities = ['北京市','上海市','广州市','深圳市','杭州市','成都市','武汉市','南京市','重庆市','西安市'];
        var fdDistricts = ['朝阳区','海淀区','浦东新区','天河区','南山区','西湖区','武侯区','洪山区','鼓楼区','渝中区'];
        var fdStreets = ['中山路','解放路','人民路','建设路','和平路','长安路','文化路','科技路','创新路','发展路'];
        $('#fdGen').addEventListener('click', function() {
          var count = parseInt($('#fdCount').value) || 5;
          var results = [];
          for (var i = 0; i < count; i++) {
            var parts = [];
            var surname = fdSurnames[Math.floor(Math.random() * fdSurnames.length)];
            var name = fdNames[Math.floor(Math.random() * fdNames.length)];
            if ($('#fdName').checked) parts.push('姓名: ' + surname + name);
            if ($('#fdPhone').checked) parts.push('手机: 1' + [3,5,7,8,9][Math.floor(Math.random()*5)] + Array.from({length:9}, function() { return Math.floor(Math.random()*10); }).join(''));
            if ($('#fdEmail').checked) parts.push('邮箱: ' + (surname + name).toLowerCase().replace(/[^\w]/g,'') + Math.floor(Math.random()*999) + '@' + fdDomains[Math.floor(Math.random()*fdDomains.length)]);
            if ($('#fdAddr').checked) parts.push('地址: ' + fdCities[Math.floor(Math.random()*fdCities.length)] + fdDistricts[Math.floor(Math.random()*fdDistricts.length)] + fdStreets[Math.floor(Math.random()*fdStreets.length)] + Math.floor(Math.random()*200+1) + '号');
            results.push(parts.join(' | '));
          }
          $('#fdOutput').textContent = results.join('\n');
        });
        break;
      case 'ipinfo':
        $('#ipInfoQuery').addEventListener('click', function() {
          var ip = $('#ipInfoInput').value.trim();
          var url = ip ? 'https://ipapi.co/' + ip + '/json/' : 'https://ipapi.co/json/';
          $('#ipInfoOutput').textContent = '查询中...';
          fetch(url).then(function(r) { return r.json(); }).then(function(data) {
            if (data.error) { $('#ipInfoOutput').textContent = '查询失败: ' + data.reason; return; }
            $('#ipInfoOutput').textContent = 'IP: ' + data.ip + '\n城市: ' + data.city + '\n地区: ' + data.region + '\n国家: ' + data.country_name + '\nISP: ' + data.org + '\n时区: ' + data.timezone + '\n经纬度: ' + data.latitude + ', ' + data.longitude;
          }).catch(function(e) { $('#ipInfoOutput').textContent = '查询失败: ' + e.message; });
        });
        break;
      case 'sslcheck':
        $('#sslCheck').addEventListener('click', function() { apiPost('/network/ssl-check', { domain: $('#sslDomain').value.trim() }, 'sslOutput'); });
        break;
      case 'dnslookup':
        $('#dnsQuery').addEventListener('click', function() { apiPost('/network/dns-lookup', { domain: $('#dnsDomain').value.trim(), record_type: $('#dnsType').value }, 'dnsOutput'); });
        break;
      case 'httpstatus':
        $('#httpCheck').addEventListener('click', function() { apiPost('/network/http-status', { url: $('#httpUrl').value.trim() }, 'httpOutput'); });
        break;
      case 'portscan':
        $('#psScan').addEventListener('click', function() { apiPost('/network/port-scan', { host: $('#psHost').value.trim(), ports: $('#psPorts').value.trim() }, 'psOutput'); });
        break;
      case 'color':
        function hexToRgb(hex) { return { r: parseInt(hex.slice(1,3), 16), g: parseInt(hex.slice(3,5), 16), b: parseInt(hex.slice(5,7), 16) }; }
        function rgbToHsl(r, g, b) {
          r /= 255; g /= 255; b /= 255;
          var max = Math.max(r,g,b), min = Math.min(r,g,b), h, s, l = (max+min)/2;
          if (max === min) { h = s = 0; } else {
            var d = max - min; s = l > 0.5 ? d/(2-max-min) : d/(max+min);
            switch(max) { case r: h = ((g-b)/d + (g<b?6:0))/6; break; case g: h = ((b-r)/d + 2)/6; break; case b: h = ((r-g)/d + 4)/6; break; }
          }
          return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
        }
        function updateColor(hex) {
          $('#colorPicker').value = hex; $('#colorPreview').style.background = hex; $('#hexInput').value = hex;
          var rgb = hexToRgb(hex); $('#rgbInput').value = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
          var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b); $('#hslInput').value = 'hsl(' + hsl.h + ',' + hsl.s + '%,' + hsl.l + '%)';
        }
        $('#colorPicker').addEventListener('input', function() { updateColor(this.value); });
        $('#hexInput').addEventListener('change', function() { if (/^#[0-9a-fA-F]{6}$/.test(this.value)) updateColor(this.value); });
        updateColor('#4f46e5');
        break;
      case 'imgbase64':
        $('#imgB64File').addEventListener('change', function(e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function(ev) {
            var dataUrl = ev.target.result;
            $('#imgB64Output').textContent = dataUrl;
            var preview = $('#imgB64Preview');
            preview.src = dataUrl; preview.style.display = 'inline-block';
          };
          reader.readAsDataURL(file);
        });
        break;
      case 'iconpreview':
        var iconData = {
          solid: ['fa-house','fa-user','fa-heart','fa-star','fa-star-half-stroke','fa-bell','fa-envelope','fa-search','fa-gear','fa-trash','fa-pen','fa-plus','fa-minus','fa-check','fa-xmark','fa-arrow-right','fa-arrow-left','fa-upload','fa-download','fa-lock','fa-unlock','fa-eye','fa-eye-slash','fa-copy','fa-paste','fa-link','fa-image','fa-file','fa-folder','fa-cloud','fa-database','fa-code','fa-terminal','fa-bug','fa-wrench','fa-hammer','fa-paintbrush','fa-palette','fa-chart-bar','fa-chart-line','fa-table','fa-list','fa-list-check','fa-filter','fa-sort','fa-shuffle','fa-rotate-right','fa-spinner','fa-circle','fa-square','fa-play','fa-pause','fa-stop','fa-forward','fa-backward','fa-volume-up','fa-volume-down','fa-volume-x','fa-music','fa-film','fa-camera','fa-wifi','fa-signal','fa-battery-full','fa-battery-half','fa-battery-empty','fa-plug','fa-lightbulb','fa-sun','fa-moon','fa-fire','fa-snowflake','fa-car','fa-plane','fa-rocket','fa-anchor','fa-map','fa-globe','fa-flag','fa-bookmark','fa-tag','fa-comment','fa-share','fa-thumbs-up','fa-thumbs-down','fa-trophy','fa-medal','fa-crown','fa-gem','fa-key','fa-shield','fa-user-shield','fa-graduation-cap','fa-certificate','fa-stamp','fa-cube','fa-cubes','fa-layer-group','fa-object-group','fa-box','fa-package','fa-briefcase','fa-coffee','fa-cutlery','fa-pizza-slice','fa-cake','fa-birthday-cake','fa-wine-glass','fa-beer','fa-soda-can','fa-smoking','fa-drumstick-bite','fa-utensils','fa-hamburger','fa-fish','fa-apple','fa-lemon','fa-orange','fa-grape','fa-cherry','fa-peach','fa-banana','fa-watermelon','fa-strawberry','fa-tree','fa-flower','fa-leaf','fa-grass','fa-mountain','fa-sunset','fa-sunrise','fa-cloud-sun','fa-cloud-moon','fa-cloud-rain','fa-cloud-snow','fa-bolt','fa-wind','fa-tornado','fa-umbrella','fa-sunglasses','fa-glasses','fa-hat-cowboy','fa-hat-cowboy-side','fa-shirt','fa-pants','fa-shoe-prints','fa-socks','fa-glove','fa-watch','fa-ring','fa-bracelet','fa-necklace','fa-headphones','fa-microphone','fa-headset','fa-phone','fa-phone-volume','fa-mobile-screen-button','fa-tablet-screen-button','fa-laptop','fa-desktop','fa-tv','fa-radio','fa-cd','fa-floppy-disk','fa-hard-drive','fa-memory-stick','fa-usb','fa-printer','fa-scanner','fa-projector','fa-monitor','fa-keyboard','fa-mouse','fa-trackpad','fa-gamepad','fa-joystick','fa-controller','fa-headset','fa-vr-cardboard','fa-arrows','fa-arrow-up','fa-arrow-down','fa-arrow-left-right','fa-arrow-up-down','fa-arrow-pointer','fa-arrow-turn-up','fa-arrow-turn-down','fa-arrow-right-from-line','fa-arrow-right-to-line','fa-arrow-left-from-line','fa-arrow-left-to-line','fa-arrow-up-from-line','fa-arrow-up-to-line','fa-arrow-down-from-line','fa-arrow-down-to-line','fa-arrow-up-right-from-square','fa-arrow-up-left-from-square','fa-arrow-down-right-from-square','fa-arrow-down-left-from-square','fa-arrow-up-right','fa-arrow-up-left','fa-arrow-down-right','fa-arrow-down-left','fa-arrow-right-long','fa-arrow-left-long','fa-arrow-up-long','fa-arrow-down-long','fa-arrow-right-short','fa-arrow-left-short','fa-arrow-up-short','fa-arrow-down-short','fa-chevron-right','fa-chevron-left','fa-chevron-up','fa-chevron-down','fa-angle-right','fa-angle-left','fa-angle-up','fa-angle-down','fa-circle-right','fa-circle-left','fa-circle-up','fa-circle-down','fa-square-right','fa-square-left','fa-square-up','fa-square-down','fa-caret-right','fa-caret-left','fa-caret-up','fa-caret-down','fa-hand-pointer','fa-hand','fa-hand-back-fist','fa-hand-peace','fa-hand-heart','fa-hand-thumbs-up','fa-hand-thumbs-down','fa-hand-clapping','fa-hand-wave','fa-people-group','fa-person','fa-person-standing','fa-person-walking','fa-person-running','fa-person-biking','fa-person-swimming','fa-person-skating','fa-person-skiing','fa-person-snowboarding','fa-person-hiking','fa-person-cane','fa-person-breastfeeding','fa-person-pregnant','fa-user-plus','fa-user-minus','fa-user-check','fa-user-xmark','fa-user-clock','fa-user-lock','fa-user-unlock','fa-user-shield','fa-user-astronaut','fa-user-nurse','fa-user-doctor','fa-user-firefighter','fa-user-police','fa-user-graduate','fa-user-tie','fa-user-suitcase','fa-users','fa-users-line','fa-user-group','fa-user-friends','fa-user-cog','fa-user-pen','fa-user-tag','fa-user-circle','fa-user-circle-check','fa-user-circle-xmark','fa-user-circle-question','fa-user-circle-exclamation','fa-user-rectangle','fa-user-rectangle-history','fa-id-card','fa-id-card-clip','fa-address-card','fa-address-book','fa-calendar','fa-calendar-days','fa-calendar-week','fa-calendar-month','fa-calendar-year','fa-calendar-check','fa-calendar-xmark','fa-calendar-minus','fa-calendar-plus','fa-calendar-clock','fa-calendar-bell','fa-calendar-heart','fa-calendar-star','fa-clock','fa-clock-rotate-left','fa-hourglass','fa-hourglass-start','fa-hourglass-half','fa-hourglass-end','fa-stopwatch','fa-timer','fa-timer-three','fa-timer-ten','fa-alarm-clock','fa-bell-ring','fa-bell-slash','fa-bell-concierge','fa-bullhorn','fa-megaphone','fa-siren','fa-bell-plus','fa-bell-minus','fa-bell-xmark','fa-bell-check','fa-comment-dots','fa-comment-alt','fa-comment-medical','fa-comment-heart','fa-comment-dollar','fa-comment-lines','fa-comments','fa-comments-dollar','fa-comments-heart','fa-message','fa-message-circle','fa-message-square','fa-message-heart','fa-message-exclamation','fa-message-question','fa-message-plus','fa-message-minus','fa-message-xmark','fa-message-check','fa-envelope-open','fa-envelope-circle-check','fa-envelope-circle-exclamation','fa-envelope-heart','fa-envelope-star','fa-envelope-open-text','fa-envelope-arrow-up-right','fa-envelope-arrow-down-left','fa-paper-plane','fa-paper-plane-top','fa-send','fa-send-to','fa-reply','fa-reply-all','fa-forward','fa-email','fa-at','fa-quote-left','fa-quote-right','fa-paragraph','fa-align-left','fa-align-center','fa-align-right','fa-align-justify','fa-list-ol','fa-list-ul','fa-list-checks','fa-list-todo','fa-indent','fa-outdent','fa-line-spacing','fa-text-height','fa-text-width','fa-font','fa-font-awesome','fa-font-plus','fa-font-minus','fa-font-italic','fa-font-bold','fa-font-strikethrough','fa-font-underline','fa-typewriter','fa-keyboard','fa-mouse-pointer','fa-hand-pointer-click','fa-mouse-pointer-click','fa-eraser','fa-pencil','fa-pencil-line','fa-pencil-alt','fa-pencil-ruler','fa-pen-nib','fa-pen-fancy','fa-pen-to-square','fa-feather','fa-feather-pointed','fa-highlighter','fa-marker','fa-brush','fa-palette','fa-paint-roller','fa-droplet','fa-spray-can','fa-palette-swatch','fa-eye-dropper','fa-scissors','fa-cut','fa-copy','fa-paste','fa-clipboard','fa-clipboard-check','fa-clipboard-list','fa-clipboard-user','fa-clipboard-arrow-up','fa-clipboard-arrow-down','fa-sticky-note','fa-sticky-note-o','fa-file-text','fa-file-text-o','fa-file-lines','fa-file-code','fa-file-image','fa-file-video','fa-file-audio','fa-file-pdf','fa-file-word','fa-file-excel','fa-file-powerpoint','fa-file-archive','fa-file-csv','fa-file-alt','fa-file-o','fa-folder-open','fa-folder-plus','fa-folder-minus','fa-folder-xmark','fa-folder-check','fa-folder-tree','fa-box-open','fa-box-plus','fa-box-minus','fa-box-xmark','fa-box-check','fa-package-open','fa-archive','fa-compress','fa-expand','fa-maximize','fa-minimize','fa-restore','fa-resize','fa-resize-horizontal','fa-resize-vertical','fa-arrows-up-down-left-right','fa-arrows-left-right','fa-arrows-up-down','fa-arrows-rotate','fa-arrows-rotate-left','fa-arrows-rotate-right','fa-arrow-rotate-left','fa-arrow-rotate-right','fa-rotate','fa-rotate-left','fa-rotate-right','fa-flip','fa-flip-horizontal','fa-flip-vertical','fa-flop-horizontal','fa-flop-vertical','fa-shuffle','fa-random','fa-repeat','fa-repeat-1','fa-repeat-1-alt','fa-refresh','fa-refresh-cw','fa-refresh-ccw','fa-sync','fa-sync-alt','fa-spinner','fa-spinner-third','fa-circle-notch','fa-hourglass-half','fa-loader','fa-cog','fa-cogs','fa-gear','fa-gears','fa-wrench','fa-screwdriver','fa-hammer','fa-pliers','fa-wrench','fa-toolbox','fa-tools','fa-gauge','fa-gauge-high','fa-gauge-simple','fa-gauge-simple-high','fa-tachometer','fa-speedometer','fa-meter','fa-meter-square','fa-meter-cube','fa-thermometer','fa-thermometer-sun','fa-thermometer-moon','fa-thermometer-half','fa-thermometer-empty','fa-thermometer-full','fa-thermometer-quarters','fa-temperature-high','fa-temperature-low','fa-humidity','fa-wind','fa-droplets','fa-cloud-droplet','fa-cloud-rain','fa-cloud-snow','fa-cloud-lightning','fa-cloud-lightning-rain','fa-sun','fa-moon','fa-star','fa-star-half','fa-star-half-stroke','fa-heart','fa-heart-pulse','fa-heart-crack','fa-flame','fa-flame-flicker','fa-flame-burner','fa-fire','fa-fire-flame','fa-fire-flame-curved','fa-ice-cream','fa-snowflake','fa-snowflake-cold','fa-fog','fa-smoke','fa-smog','fa-dust','fa-tornado','fa-wind-turbine','fa-umbrella','fa-umbrella-beach','fa-sunglasses','fa-glasses','fa-mask','fa-face-smile','fa-face-frown','fa-face-meh','fa-face-grin','fa-face-laugh','fa-face-cry','fa-face-surprise','fa-face-sad-tear','fa-face-wink','fa-face-kiss','fa-face-smile-beam','fa-face-smile-plus','fa-face-frown-open','fa-face-meh-blank','fa-face-grin-wide','fa-face-grin-beam','fa-face-grin-squint','fa-face-grin-hearts','fa-face-laugh-beam','fa-face-laugh-squint','fa-face-cry-bounce','fa-face-surprise-open','fa-face-sad-tear','fa-face-wink-beam','fa-face-kiss-beam','fa-face-kiss-wink-heart','fa-face-dizzy','fa-face-exhausted','fa-face-confused','fa-face-triangle-exclamation','fa-face-circle-exclamation','fa-face-circle-question','fa-face-circle-info','fa-face-circle-xmark','fa-face-circle-check','fa-face-angel','fa-face-devil','fa-face-ghost','fa-face-skull','fa-face-skull-crossbones','fa-hand-dragon','fa-hand-sparkles','fa-hand-cursor-pointer','fa-hand-grab','fa-hand-grabbing','fa-hand-paper','fa-hand-rock','fa-hand-scissors','fa-hand-lizard','fa-hand-spock','fa-hand-peace','fa-hand-heart','fa-hand-thumbs-up','fa-hand-thumbs-down','fa-hand-clapping','fa-hand-wave','fa-hand-point-up','fa-hand-point-right','fa-hand-point-down','fa-hand-point-left','fa-hand-back-fist','fa-hand-fist','fa-hand-swords','fa-hand-dollar-sign','fa-hand-euro-sign','fa-hand-pound-sign','fa-hand-yen-sign','fa-hand-ruble-sign','fa-hand-bitcoin-sign','fa-hand-rupee-sign','fa-hand-won-sign','fa-hand-lira-sign','fa-hand-colon-sign','fa-hand-gem','fa-hand-crown','fa-hand-trophy','fa-hand-medal','fa-hand-award','fa-hand-certificate','fa-hand-diploma','fa-hand-scroll','fa-hand-file-text','fa-hand-file-code','fa-hand-file-image','fa-hand-file-video','fa-hand-file-audio','fa-hand-file-pdf','fa-hand-file-word','fa-hand-file-excel','fa-hand-file-powerpoint','fa-hand-file-archive','fa-hand-file-csv','fa-hand-box','fa-hand-briefcase','fa-hand-package','fa-hand-gift','fa-hand-heart-crack','fa-hand-heart-pulse','fa-hand-flame','fa-hand-fire','fa-hand-snowflake','fa-hand-cloud','fa-hand-cloud-rain','fa-hand-cloud-snow','fa-hand-cloud-lightning','fa-hand-sun','fa-hand-moon','fa-hand-star','fa-hand-flag','fa-hand-globe','fa-hand-map','fa-hand-location','fa-hand-compass','fa-hand-hiking','fa-hand-biking','fa-hand-swimming','fa-hand-running','fa-hand-walking','fa-hand-standing','fa-hand-person','fa-hand-users','fa-hand-user-plus','fa-hand-user-minus','fa-hand-user-check','fa-hand-user-xmark','fa-hand-user-circle','fa-hand-user-astronaut','fa-hand-user-nurse','fa-hand-user-doctor','fa-hand-user-firefighter','fa-hand-user-police','fa-hand-user-graduate','fa-hand-user-tie','fa-hand-user-suitcase','fa-hand-id-card','fa-hand-address-card','fa-hand-calendar','fa-hand-clock','fa-hand-alarm-clock','fa-hand-bell','fa-hand-envelope','fa-hand-comment','fa-hand-message','fa-hand-paper-plane','fa-hand-send','fa-hand-reply','fa-hand-forward','fa-hand-quote','fa-hand-paragraph','fa-hand-align-left','fa-hand-align-center','fa-hand-align-right','fa-hand-align-justify','fa-hand-list-ol','fa-hand-list-ul','fa-hand-list-check','fa-hand-list-todo','fa-hand-indent','fa-hand-outdent','fa-hand-font','fa-hand-pencil','fa-hand-pen','fa-hand-feather','fa-hand-highlighter','fa-hand-marker','fa-hand-brush','fa-hand-palette','fa-hand-paint-roller','fa-hand-droplet','fa-hand-spray-can','fa-hand-eye-dropper','fa-hand-scissors','fa-hand-cut','fa-hand-copy','fa-hand-paste','fa-hand-clipboard','fa-hand-sticky-note','fa-hand-file','fa-hand-folder','fa-hand-box','fa-hand-archive','fa-hand-compress','fa-hand-expand','fa-hand-maximize','fa-hand-minimize','fa-hand-resize','fa-hand-arrows','fa-hand-rotate','fa-hand-flip','fa-hand-shuffle','fa-hand-refresh','fa-hand-spinner','fa-hand-cog','fa-hand-wrench','fa-hand-toolbox','fa-hand-gauge','fa-hand-thermometer','fa-hand-tachometer','fa-hand-humidity','fa-hand-wind','fa-hand-umbrella','fa-hand-sunglasses','fa-hand-glasses','fa-hand-mask','fa-hand-face-smile','fa-hand-face-frown','fa-hand-face-meh','fa-hand-face-grin','fa-hand-face-laugh','fa-hand-face-cry','fa-hand-face-surprise','fa-hand-face-sad-tear','fa-hand-face-wink','fa-hand-face-kiss','fa-hand-face-angel','fa-hand-face-devil','fa-hand-face-ghost','fa-hand-face-skull','fa-hand-skull-crossbones','fa-hand-dragon','fa-hand-sparkles','fa-hand-cursor-pointer'],
          regular: ['fa-circle','fa-circle-dot','fa-circle-notch','fa-square','fa-square-full','fa-square-check','fa-square-xmark','fa-square-minus','fa-square-plus','fa-square-circle','fa-square-caret-right','fa-square-caret-down','fa-square-caret-up','fa-square-caret-left','fa-square-root','fa-square-h','fa-square-v','fa-square-poll-horizontal','fa-square-poll-vertical','fa-square-arrow-up-right','fa-square-arrow-down-left','fa-square-arrow-up-left','fa-square-arrow-down-right','fa-square-full','fa-square-left','fa-square-right','fa-square-up','fa-square-down','fa-square-external-link','fa-square-internal-link','fa-square-phone','fa-square-envelope','fa-square-mail','fa-square-at','fa-square-share-nodes','fa-square-share','fa-square-share-from-square','fa-square-copy','fa-square-cut','fa-square-paste','fa-square-rotate-right','fa-square-rotate-left','fa-square-flip-horizontal','fa-square-flip-vertical','fa-square-shuffle','fa-square-sync','fa-square-spinner','fa-square-cog','fa-square-wrench','fa-square-toolbox','fa-square-hammer','fa-square-screwdriver','fa-square-pliers','fa-square-calendar','fa-square-clock','fa-square-bell','fa-square-envelope-open','fa-square-comment','fa-square-message','fa-square-paper-plane','fa-square-send','fa-square-reply','fa-square-forward','fa-square-quote-left','fa-square-quote-right','fa-square-paragraph','fa-square-list-ul','fa-square-list-ol','fa-square-list-check','fa-square-list-todo','fa-square-indent','fa-square-outdent','fa-square-font','fa-square-pencil','fa-square-pen','fa-square-feather','fa-square-highlighter','fa-square-marker','fa-square-brush','fa-square-palette','fa-square-paint-roller','fa-square-droplet','fa-square-spray-can','fa-square-eye-dropper','fa-square-scissors','fa-square-cut','fa-square-copy','fa-square-paste','fa-square-clipboard','fa-square-sticky-note','fa-square-file','fa-square-file-text','fa-square-file-code','fa-square-file-image','fa-square-file-video','fa-square-file-audio','fa-square-file-pdf','fa-square-file-word','fa-square-file-excel','fa-square-file-powerpoint','fa-square-file-archive','fa-square-file-csv','fa-square-folder','fa-square-folder-open','fa-square-box','fa-square-package','fa-square-archive','fa-square-compress','fa-square-expand','fa-square-maximize','fa-square-minimize','fa-square-resize','fa-square-arrows','fa-square-arrows-up-down-left-right','fa-square-arrows-left-right','fa-square-arrows-up-down','fa-square-arrows-rotate','fa-square-arrow-rotate-left','fa-square-arrow-rotate-right','fa-square-rotate','fa-square-rotate-left','fa-square-rotate-right','fa-square-flip','fa-square-flip-horizontal','fa-square-flip-vertical','fa-square-flop-horizontal','fa-square-flop-vertical','fa-square-shuffle','fa-square-random','fa-square-repeat','fa-square-repeat-1','fa-square-repeat-1-alt','fa-square-refresh','fa-square-refresh-cw','fa-square-refresh-ccw','fa-square-sync','fa-square-sync-alt','fa-square-spinner','fa-square-spinner-third','fa-square-circle-notch','fa-square-hourglass-half','fa-square-loader','fa-square-cog','fa-square-cogs','fa-square-gear','fa-square-gears','fa-square-wrench','fa-square-screwdriver','fa-square-hammer','fa-square-pliers','fa-square-toolbox','fa-square-tools','fa-square-gauge','fa-square-gauge-high','fa-square-gauge-simple','fa-square-gauge-simple-high','fa-square-tachometer','fa-square-speedometer','fa-square-meter','fa-square-meter-square','fa-square-meter-cube','fa-square-thermometer','fa-square-thermometer-sun','fa-square-thermometer-moon','fa-square-thermometer-half','fa-square-thermometer-empty','fa-square-thermometer-full','fa-square-thermometer-quarters','fa-square-temperature-high','fa-square-temperature-low','fa-square-humidity','fa-square-wind','fa-square-droplets','fa-square-cloud-droplet','fa-square-cloud-rain','fa-square-cloud-snow','fa-square-cloud-lightning','fa-square-cloud-lightning-rain','fa-square-sun','fa-square-moon','fa-square-star','fa-square-star-half','fa-square-star-half-stroke','fa-square-heart','fa-square-heart-pulse','fa-square-heart-crack','fa-square-flame','fa-square-flame-flicker','fa-square-flame-burner','fa-square-fire','fa-square-fire-flame','fa-square-fire-flame-curved','fa-square-ice-cream','fa-square-snowflake','fa-square-snowflake-cold','fa-square-fog','fa-square-smoke','fa-square-smog','fa-square-dust','fa-square-tornado','fa-square-wind-turbine','fa-square-umbrella','fa-square-umbrella-beach','fa-square-sunglasses','fa-square-glasses','fa-square-mask','fa-square-face-smile','fa-square-face-frown','fa-square-face-meh','fa-square-face-grin','fa-square-face-laugh','fa-square-face-cry','fa-square-face-surprise','fa-square-face-sad-tear','fa-square-face-wink','fa-square-face-kiss','fa-square-face-smile-beam','fa-square-face-smile-plus','fa-square-face-frown-open','fa-square-face-meh-blank','fa-square-face-grin-wide','fa-square-face-grin-beam','fa-square-face-grin-squint','fa-square-face-grin-hearts','fa-square-face-laugh-beam','fa-square-face-laugh-squint','fa-square-face-cry-bounce','fa-square-face-surprise-open','fa-square-face-sad-tear','fa-square-face-wink-beam','fa-square-face-kiss-beam','fa-square-face-kiss-wink-heart','fa-square-face-dizzy','fa-square-face-exhausted','fa-square-face-confused','fa-square-face-triangle-exclamation','fa-square-face-circle-exclamation','fa-square-face-circle-question','fa-square-face-circle-info','fa-square-face-circle-xmark','fa-square-face-circle-check','fa-square-face-angel','fa-square-face-devil','fa-square-face-ghost','fa-square-face-skull','fa-square-face-skull-crossbones','fa-square-hand-dragon','fa-square-hand-sparkles','fa-square-hand-cursor-pointer','fa-square-hand-grab','fa-square-hand-grabbing','fa-square-hand-paper','fa-square-hand-rock','fa-square-hand-scissors','fa-square-hand-lizard','fa-square-hand-spock','fa-square-hand-peace','fa-square-hand-heart','fa-square-hand-thumbs-up','fa-square-hand-thumbs-down','fa-square-hand-clapping','fa-square-hand-wave','fa-square-hand-point-up','fa-square-hand-point-right','fa-square-hand-point-down','fa-square-hand-point-left','fa-square-hand-back-fist','fa-square-hand-fist','fa-square-hand-swords','fa-square-hand-dollar-sign','fa-square-hand-euro-sign','fa-square-hand-pound-sign','fa-square-hand-yen-sign','fa-square-hand-ruble-sign','fa-square-hand-bitcoin-sign','fa-square-hand-rupee-sign','fa-square-hand-won-sign','fa-square-hand-lira-sign','fa-square-hand-colon-sign','fa-square-hand-gem','fa-square-hand-crown','fa-square-hand-trophy','fa-square-hand-medal','fa-square-hand-award','fa-square-hand-certificate','fa-square-hand-diploma','fa-square-hand-scroll','fa-square-hand-file-text','fa-square-hand-file-code','fa-square-hand-file-image','fa-square-hand-file-video','fa-square-hand-file-audio','fa-square-hand-file-pdf','fa-square-hand-file-word','fa-square-hand-file-excel','fa-square-hand-file-powerpoint','fa-square-hand-file-archive','fa-square-hand-file-csv','fa-square-hand-box','fa-square-hand-briefcase','fa-square-hand-package','fa-square-hand-gift','fa-square-hand-heart-crack','fa-square-hand-heart-pulse','fa-square-hand-flame','fa-square-hand-fire','fa-square-hand-snowflake','fa-square-hand-cloud','fa-square-hand-cloud-rain','fa-square-hand-cloud-snow','fa-square-hand-cloud-lightning','fa-square-hand-sun','fa-square-hand-moon','fa-square-hand-star','fa-square-hand-flag','fa-square-hand-globe','fa-square-hand-map','fa-square-hand-location','fa-square-hand-compass','fa-square-hand-hiking','fa-square-hand-biking','fa-square-hand-swimming','fa-square-hand-running','fa-square-hand-walking','fa-square-hand-standing','fa-square-hand-person','fa-square-hand-users','fa-square-hand-user-plus','fa-square-hand-user-minus','fa-square-hand-user-check','fa-square-hand-user-xmark','fa-square-hand-user-circle','fa-square-hand-user-astronaut','fa-square-hand-user-nurse','fa-square-hand-user-doctor','fa-square-hand-user-firefighter','fa-square-hand-user-police','fa-square-hand-user-graduate','fa-square-hand-user-tie','fa-square-hand-user-suitcase','fa-square-hand-id-card','fa-square-hand-address-card','fa-square-hand-calendar','fa-square-hand-clock','fa-square-hand-alarm-clock','fa-square-hand-bell','fa-square-hand-envelope','fa-square-hand-comment','fa-square-hand-message','fa-square-hand-paper-plane','fa-square-hand-send','fa-square-hand-reply','fa-square-hand-forward','fa-square-hand-quote','fa-square-hand-paragraph','fa-square-hand-align-left','fa-square-hand-align-center','fa-square-hand-align-right','fa-square-hand-align-justify','fa-square-hand-list-ol','fa-square-hand-list-ul','fa-square-hand-list-check','fa-square-hand-list-todo','fa-square-hand-indent','fa-square-hand-outdent','fa-square-hand-font','fa-square-hand-pencil','fa-square-hand-pen','fa-square-hand-feather','fa-square-hand-highlighter','fa-square-hand-marker','fa-square-hand-brush','fa-square-hand-palette','fa-square-hand-paint-roller','fa-square-hand-droplet','fa-square-hand-spray-can','fa-square-hand-eye-dropper','fa-square-hand-scissors','fa-square-hand-cut','fa-square-hand-copy','fa-square-hand-paste','fa-square-hand-clipboard','fa-square-hand-sticky-note','fa-square-hand-file','fa-square-hand-folder','fa-square-hand-box','fa-square-hand-archive','fa-square-hand-compress','fa-square-hand-expand','fa-square-hand-maximize','fa-square-hand-minimize','fa-square-hand-resize','fa-square-hand-arrows','fa-square-hand-rotate','fa-square-hand-flip','fa-square-hand-shuffle','fa-square-hand-refresh','fa-square-hand-spinner','fa-square-hand-cog','fa-square-hand-wrench','fa-square-hand-toolbox','fa-square-hand-gauge','fa-square-hand-thermometer','fa-square-hand-tachometer','fa-square-hand-humidity','fa-square-hand-wind','fa-square-hand-umbrella','fa-square-hand-sunglasses','fa-square-hand-glasses','fa-square-hand-mask','fa-square-hand-face-smile','fa-square-hand-face-frown','fa-square-hand-face-meh','fa-square-hand-face-grin','fa-square-hand-face-laugh','fa-square-hand-face-cry','fa-square-hand-face-surprise','fa-square-hand-face-sad-tear','fa-square-hand-face-wink','fa-square-hand-face-kiss','fa-square-hand-face-angel','fa-square-hand-face-devil','fa-square-hand-face-ghost','fa-square-hand-face-skull','fa-square-hand-skull-crossbones','fa-square-hand-dragon','fa-square-hand-sparkles','fa-square-hand-cursor-pointer'],
          brands: ['fa-facebook','fa-facebook-f','fa-messenger','fa-instagram','fa-whatsapp','fa-twitter','fa-x-twitter','fa-tiktok','fa-youtube','fa-youtube-play','fa-youtube-square','fa-vimeo','fa-vimeo-v','fa-dribbble','fa-behance','fa-linkedin','fa-linkedin-in','fa-pinterest','fa-pinterest-p','fa-snapchat','fa-snapchat-ghost','fa-reddit','fa-reddit-alien','fa-tumblr','fa-tumblr-square','fa-flickr','fa-deviantart','fa-500px','fa-github','fa-github-alt','fa-github-square','fa-gitlab','fa-bitbucket','fa-bitbucket-square','fa-stack-overflow','fa-stack-exchange','fa-codeforces','fa-codepen','fa-codesandbox','fa-jsfiddle','fa-jsfiddle','fa-repl','fa-repl-it','fa-git','fa-git-alt','fa-git-square','fa-npm','fa-yarn','fa-node','fa-node-js','fa-python','fa-java','fa-js','fa-js-square','fa-react','fa-reacteurope','fa-vuejs','fa-vue','fa-angular','fa-angularjs','fa-bootstrap','fa-sass','fa-css3','fa-css3-alt','fa-html5','fa-html5-alt','fa-xml','fa-xml-square','fa-database','fa-mysql','fa-postgresql','fa-sqlite','fa-mongodb','fa-redis','fa-aws','fa-amazon','fa-amazon-pay','fa-google','fa-google-plus','fa-google-plus-g','fa-google-pay','fa-google-wallet','fa-apple','fa-apple-pay','fa-app-store','fa-app-store-ios','fa-microsoft','fa-windows','fa-linux','fa-android','fa-docker','fa-kubernetes','fa-k8s','fa-helm','fa-minikube','fa-openshift','fa-virtualbox','fa-vmware','fa-ubuntu','fa-debian','fa-centos','fa-fedora','fa-redhat','fa-suse','fa-archlinux','fa-gentoo','fa-alpine','fa-nixos','fa-flutter','fa-dart','fa-swift','fa-kotlin','fa-go','fa-golang','fa-rust','fa-rust-lang','fa-c','fa-c-plus-plus','fa-c-sharp','fa-typescript','fa-ts','fa-assembly','fa-lua','fa-perl','fa-ruby','fa-rails','fa-django','fa-flask','fa-fastapi','fa-express','fa-nestjs','fa-spring','fa-spring-boot','fa-hibernate','fa-mybatis','fa-tensorflow','fa-pytorch','fa-keras','fa-scikit-learn','fa-jupyter','fa-colab','fa-hugging-face','fa-openai','fa-chatgpt','fa-google-ai','fa-microsoft-ai','fa-anthropic','fa-amazon-ai','fa-alibaba','fa-taobao','fa-tmall','fa-jd','fa-pinduoduo','fa-meituan','fa-eleme','fa-didi','fa-wechat','fa-weixin','fa-weibo','fa-qq','fa-qzone','fa-bilibili','fa-douyin','fa-kuaishou','fa-xiaohongshu','fa-zhihu','fa-csdn','fa-oschina','fa-gitee','fa-sogou','fa-baidu','fa-taobao','fa-tmall','fa-jd','fa-pinduoduo','fa-meituan','fa-eleme','fa-didi','fa-wechat','fa-weixin','fa-weibo','fa-qq','fa-qzone','fa-bilibili','fa-douyin','fa-kuaishou','fa-xiaohongshu','fa-zhihu','fa-csdn','fa-oschina','fa-gitee','fa-sogou','fa-baidu','fa-alipay','fa-credit-card','fa-credit-card-front','fa-credit-card-back','fa-banknote','fa-coins','fa-wallet','fa-money-bill','fa-money-bill-alt','fa-money-bill-wave','fa-money-bill-transfer','fa-money-check','fa-money-check-alt','fa-money-check-dollar','fa-money-check-euro','fa-receipt','fa-receipt-cutoff','fa-file-invoice','fa-file-invoice-dollar','fa-file-invoice-euro','fa-ticket','fa-ticket-alt','fa-ticket-percent','fa-gift-card','fa-gift','fa-heart','fa-heart-pulse','fa-heart-crack','fa-star','fa-star-half','fa-star-half-stroke','fa-thumbs-up','fa-thumbs-down','fa-share','fa-share-alt','fa-share-square','fa-share-square-o','fa-copy','fa-paste','fa-cut','fa-clipboard','fa-clipboard-list','fa-clipboard-check','fa-paperclip','fa-link','fa-linkedin','fa-linkedin-in','fa-external-link','fa-external-link-alt','fa-external-link-square','fa-external-link-square-alt','fa-internal-link','fa-internal-link-alt','fa-phone','fa-phone-alt','fa-phone-volume','fa-mobile','fa-mobile-alt','fa-mobile-screen','fa-mobile-screen-button','fa-tablet','fa-tablet-alt','fa-tablet-screen','fa-tablet-screen-button','fa-laptop','fa-laptop-code','fa-desktop','fa-monitor','fa-tv','fa-tv-alt','fa-radio','fa-radio-alt','fa-cd','fa-dvd','fa-blue-ray','fa-disc','fa-floppy-disk','fa-hard-drive','fa-memory-stick','fa-usb','fa-printer','fa-scanner','fa-projector','fa-headphones','fa-headphones-alt','fa-headset','fa-microphone','fa-microphone-alt','fa-microphone-slash','fa-volume-up','fa-volume-down','fa-volume-off','fa-volume-x','fa-music','fa-play','fa-pause','fa-stop','fa-forward','fa-backward','fa-fast-forward','fa-fast-backward','fa-step-forward','fa-step-backward','fa-eject','fa-repeat','fa-repeat-1','fa-repeat-1-alt','fa-shuffle','fa-random','fa-list','fa-list-ul','fa-list-ol','fa-list-check','fa-list-todo','fa-list-alt','fa-list-square','fa-align-left','fa-align-center','fa-align-right','fa-align-justify','fa-indent','fa-outdent','fa-text-height','fa-text-width','fa-font','fa-font-awesome','fa-font-awesome-alt','fa-font-awesome-flag','fa-font-awesome-logo-full','fa-font-awesome-brands','fa-font-awesome-solid','fa-font-awesome-regular','fa-font-awesome-light','fa-font-awesome-duotone','fa-font-awesome-v4','fa-font-awesome-v4-font-awesome','fa-font-awesome-v4-icon','fa-font-awesome-v4-logo','fa-font-awesome-v4-square','fa-font-awesome-v4-brands','fa-font-awesome-v4-solid','fa-font-awesome-v4-regular','fa-font-awesome-v4-light','fa-font-awesome-v4-duotone','fa-font-awesome-v4-o','fa-font-awesome-v4-a','fa-font-awesome-v4-5','fa-font-awesome-v4-6','fa-font-awesome-v4-7','fa-font-awesome-v4-8','fa-font-awesome-v4-9','fa-font-awesome-v4-10','fa-font-awesome-v4-11','fa-font-awesome-v4-12','fa-font-awesome-v4-13','fa-font-awesome-v4-14','fa-font-awesome-v4-15','fa-font-awesome-v4-16','fa-font-awesome-v4-17','fa-font-awesome-v4-18','fa-font-awesome-v4-19','fa-font-awesome-v4-20','fa-font-awesome-v4-21','fa-font-awesome-v4-22','fa-font-awesome-v4-23','fa-font-awesome-v4-24','fa-font-awesome-v4-25','fa-font-awesome-v4-26','fa-font-awesome-v4-27','fa-font-awesome-v4-28','fa-font-awesome-v4-29','fa-font-awesome-v4-30','fa-font-awesome-v4-31','fa-font-awesome-v4-32','fa-font-awesome-v4-33','fa-font-awesome-v4-34','fa-font-awesome-v4-35','fa-font-awesome-v4-36','fa-font-awesome-v4-37','fa-font-awesome-v4-38','fa-font-awesome-v4-39','fa-font-awesome-v4-40','fa-font-awesome-v4-41','fa-font-awesome-v4-42','fa-font-awesome-v4-43','fa-font-awesome-v4-44','fa-font-awesome-v4-45','fa-font-awesome-v4-46','fa-font-awesome-v4-47','fa-font-awesome-v4-48','fa-font-awesome-v4-49','fa-font-awesome-v4-50']
        };
        var currentType = 'solid';
        var typeButtons = '<button class="btn btn-primary" id="iconTypeSolid" data-type="solid">Solid</button> ' +
          '<button class="btn" id="iconTypeRegular" data-type="regular">Regular</button> ' +
          '<button class="btn" id="iconTypeBrands" data-type="brands">Brands</button>';
        $('#iconGrid').insertAdjacentHTML('beforebegin', '<div class="toolbox-tool-row" style="margin-bottom:8px;">' + typeButtons + '</div>');
        
        function renderIcons(filter) {
          var list = iconData[currentType] || [];
          var prefix = currentType === 'solid' ? 'fa-solid' : currentType === 'regular' ? 'fa-regular' : 'fa-brands';
          var filtered = filter ? list.filter(function(n) { return n.indexOf(filter) !== -1; }) : list;
          $('#iconGrid').innerHTML = filtered.map(function(n) {
            return '<div style="text-align:center;padding:8px;cursor:pointer;border-radius:var(--radius-sm);transition:var(--transition);border:2px solid transparent;" ' +
              'onmouseover="this.style.background=\'var(--primary-light)\'" onmouseout="this.style.background=\'transparent\'" ' +
              'data-prefix="' + prefix + '" data-icon="' + n + '">' +
              '<i class="' + prefix + ' ' + n + '" style="font-size:24px;"></i>' +
              '<div style="font-size:10px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);">' + n + '</div></div>';
          }).join('');
          $$('#iconGrid > div').forEach(function(el) {
            el.addEventListener('click', function() {
              var prefix = el.dataset.prefix;
              var iconName = el.dataset.icon;
              var className = prefix + ' ' + iconName;
              $$('#iconGrid > div').forEach(function(d) { d.style.borderColor = 'transparent'; });
              el.style.borderColor = 'var(--primary-color)';
              $('#iconOutput').innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);">' +
                '<i class="' + className + '" style="font-size:32px;"></i>' +
                '<div style="flex:1;"><div style="font-size:14px;font-weight:600;">' + className + '</div><div style="font-size:12px;color:var(--text-secondary);">点击下方按钮复制</div></div>' +
                '<button class="btn btn-primary" id="iconCopyBtn"><i class="fa-solid fa-copy"></i> 复制</button></div>';
              $('#iconCopyBtn').addEventListener('click', function() {
                navigator.clipboard.writeText(className).then(function() {
                  var btn = $('#iconCopyBtn');
                  var orig = btn.innerHTML;
                  btn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                  setTimeout(function() { btn.innerHTML = orig; }, 2000);
                });
              });
            });
          });
        }
        
        $$('#iconTypeSolid, #iconTypeRegular, #iconTypeBrands').forEach(function(btn) {
          btn.addEventListener('click', function() {
            $$('#iconTypeSolid, #iconTypeRegular, #iconTypeBrands').forEach(function(b) { b.classList.remove('btn-primary'); });
            this.classList.add('btn-primary');
            currentType = this.dataset.type;
            renderIcons($('#iconSearch').value.trim());
          });
        });
        
        $('#iconSearch').addEventListener('input', function() { renderIcons(this.value.trim()); });
        renderIcons('');
        break;
      case 'palette':
        function palHexToHsl(hex) {
          var r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
          var max = Math.max(r,g,b), min = Math.min(r,g,b), h, s, l = (max+min)/2;
          if (max === min) { h = s = 0; } else {
            var d = max - min; s = l > 0.5 ? d/(2-max-min) : d/(max+min);
            switch(max) { case r: h = ((g-b)/d + (g<b?6:0))/6; break; case g: h = ((b-r)/d + 2)/6; break; case b: h = ((r-g)/d + 4)/6; break; }
          }
          return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
        }
        function hslToHex(h, s, l) {
          s /= 100; l /= 100;
          var c = (1 - Math.abs(2*l-1)) * s, x = c * (1 - Math.abs((h/60)%2-1)), m = l - c/2, r, g, b;
          if (h < 60) { r=c; g=x; b=0; } else if (h < 120) { r=x; g=c; b=0; } else if (h < 180) { r=0; g=c; b=x; } else if (h < 240) { r=0; g=x; b=c; } else if (h < 300) { r=x; g=0; b=c; } else { r=c; g=0; b=x; }
          return '#' + [r+m,g+m,b+m].map(function(v) { return Math.round(v*255).toString(16).padStart(2,'0'); }).join('');
        }
        $('#palGen').addEventListener('click', function() {
          var base = $('#palBase').value;
          var hsl = palHexToHsl(base);
          var colors = [];
          for (var i = 0; i < 5; i++) {
            var h = (hsl[0] + i * 30) % 360;
            colors.push(hslToHex(h, Math.min(100, hsl[1] + 10), Math.max(20, Math.min(80, hsl[2] + (i-2)*10))));
          }
          colors.push(base);
          $('#palResult').innerHTML = colors.map(function(c) {
            var l = palHexToHsl(c)[2];
            return '<div style="width:60px;height:60px;background:' + c + ';border-radius:var(--radius-sm);display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;"><span style="font-size:10px;color:' + (l > 50 ? '#000' : '#fff') + ';">' + c + '</span></div>';
          }).join('');
        });
        break;
      case 'imgcompress':
        $('#imgCompQuality').addEventListener('input', function() { $('#imgCompQVal').textContent = this.value + '%'; });
        $('#imgCompRun').addEventListener('click', function() {
          var file = $('#imgCompFile').files[0];
          if (!file) { $('#imgCompOutput').textContent = '请选择图片'; return; }
          var quality = parseInt($('#imgCompQuality').value) / 100;
          var reader = new FileReader();
          reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
              var canvas = $('#imgCompCanvas');
              canvas.width = img.width; canvas.height = img.height;
              canvas.style.display = 'inline-block';
              var ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(function(blob) {
                var origSize = file.size;
                var newSize = blob.size;
                var ratio = ((1 - newSize / origSize) * 100).toFixed(1);
                $('#imgCompOutput').textContent = '原始: ' + (origSize/1024).toFixed(1) + 'KB → 压缩后: ' + (newSize/1024).toFixed(1) + 'KB (节省 ' + ratio + '%)';
              }, file.type, quality);
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
        break;
      case 'unitconv':
        var unitData = {
          length: { units: ['米','千米','厘米','毫米','英寸','英尺','英里','码'], factors: [1, 1000, 0.01, 0.001, 0.0254, 0.3048, 1609.344, 0.9144] },
          weight: { units: ['千克','克','毫克','吨','磅','盎司'], factors: [1, 0.001, 0.000001, 1000, 0.453592, 0.0283495] },
          temp: { units: ['摄氏度','华氏度','开尔文'], factors: null },
          area: { units: ['平方米','平方千米','平方厘米','公顷','亩','平方英尺','平方英里'], factors: [1, 1000000, 0.0001, 10000, 666.667, 0.092903, 2589988] },
          volume: { units: ['升','毫升','立方米','加仑(美)','品脱(美)','立方英寸'], factors: [1, 0.001, 1000, 3.78541, 0.473176, 0.0163871] }
        };
        function updateUnitSelects() {
          var type = $('#unitType').value;
          var units = unitData[type].units;
          ['unitFrom','unitTo'].forEach(function(id) {
            $('#' + id).innerHTML = units.map(function(u, i) { return '<option value="' + i + '">' + u + '</option>'; }).join('');
          });
        }
        $('#unitType').addEventListener('change', updateUnitSelects);
        updateUnitSelects();
        $('#unitConv').addEventListener('click', function() {
          var type = $('#unitType').value, val = parseFloat($('#unitVal').value), from = parseInt($('#unitFrom').value), to = parseInt($('#unitTo').value);
          if (isNaN(val)) { $('#unitOutput').textContent = '请输入数值'; return; }
          var result;
          if (type === 'temp') {
            if (from === 0 && to === 1) result = val * 9/5 + 32;
            else if (from === 1 && to === 0) result = (val - 32) * 5/9;
            else if (from === 0 && to === 2) result = val + 273.15;
            else if (from === 2 && to === 0) result = val - 273.15;
            else if (from === 1 && to === 2) result = (val - 32) * 5/9 + 273.15;
            else if (from === 2 && to === 1) result = (val - 273.15) * 9/5 + 32;
            else result = val;
          } else {
            var d = unitData[type];
            result = (val * d.factors[from]) / d.factors[to];
          }
          $('#unitOutput').textContent = val + ' ' + unitData[type].units[from] + ' = ' + result.toFixed(6) + ' ' + unitData[type].units[to];
        });
        break;
      case 'calculator':
        $('#calcEval').addEventListener('click', function() {
          try {
            var expr = $('#calcInput').value.trim();
            var result = Function('"use strict"; return (' + expr + ')')();
            $('#calcOutput').textContent = '= ' + result;
          } catch(e) { $('#calcOutput').textContent = '错误: ' + e.message; }
        });
        $('#calcClear').addEventListener('click', function() { $('#calcInput').value = ''; $('#calcOutput').textContent = ''; });
        break;
      case 'percent':
        $('#pctCalc1').addEventListener('click', function() {
          var x = parseFloat($('#pctX').value), y = parseFloat($('#pctY').value);
          if (isNaN(x) || isNaN(y) || y === 0) { $('#pctOutput').textContent = '请输入有效数值'; return; }
          $('#pctOutput').textContent = x + ' 是 ' + y + ' 的 ' + (x/y*100).toFixed(2) + '%';
        });
        $('#pctCalc2').addEventListener('click', function() {
          var a = parseFloat($('#pctA').value), b = parseFloat($('#pctB').value);
          if (isNaN(a) || isNaN(b)) { $('#pctOutput').textContent = '请输入有效数值'; return; }
          $('#pctOutput').textContent = a + ' 的 ' + b + '% = ' + (a*b/100).toFixed(2);
        });
        $('#pctCalc3').addEventListener('click', function() {
          var old = parseFloat($('#pctOld').value), nw = parseFloat($('#pctNew').value);
          if (isNaN(old) || isNaN(nw) || old === 0) { $('#pctOutput').textContent = '请输入有效数值'; return; }
          var pct = ((nw - old) / Math.abs(old) * 100).toFixed(2);
          $('#pctOutput').textContent = '变化: ' + pct + '% (' + (pct > 0 ? '增加' : '减少') + ')';
        });
        break;
      case 'regex':
        $('#regexTest').addEventListener('click', function() {
          try {
            var patternStr = $('#regexPattern').value;
            var match = patternStr.match(/^\/(.+)\/([gimsu]*)$/);
            var regex = match ? new RegExp(match[1], match[2]) : new RegExp(patternStr, 'g');
            var text = $('#regexInput').value;
            var results = [], m;
            while ((m = regex.exec(text)) !== null) { results.push('匹配: "' + m[0] + '" 位置: ' + m.index); if (!regex.global) break; }
            $('#regexOutput').textContent = results.length > 0 ? results.join('\n') : '无匹配结果';
          } catch(e) { $('#regexOutput').textContent = '正则错误: ' + e.message; }
        });
        break;
      case 'cron':
        $('#cronGen').addEventListener('click', function() {
          var expr = [$('#cronMin').value, $('#cronHour').value, $('#cronDay').value, $('#cronMon').value, $('#cronWeek').value].join(' ');
          $('#cronOutput').textContent = 'Cron表达式: ' + expr;
        });
        $('#cronParse').addEventListener('click', function() {
          var expr = [$('#cronMin').value, $('#cronHour').value, $('#cronDay').value, $('#cronMon').value, $('#cronWeek').value].join(' ');
          var parts = expr.split(/\s+/);
          var desc = [];
          if (parts[0] !== '*') desc.push('每' + parts[0] + '分钟'); else desc.push('每分钟');
          if (parts[1] !== '*') desc.push(parts[1] + '时');
          if (parts[2] !== '*') desc.push(parts[2] + '日');
          if (parts[3] !== '*') desc.push(parts[3] + '月');
          if (parts[4] !== '*') desc.push('周' + parts[4]);
          $('#cronOutput').textContent = '表达式: ' + expr + '\n含义: ' + desc.join('，');
        });
        break;
      case 'regexlib':
        var lib = [
          { name: '手机号', pattern: '^1[3-9]\\d{9}$', desc: '中国大陆手机号' },
          { name: '邮箱', pattern: '^[\\w.-]+@[\\w.-]+\\.\\w{2,}$', desc: '常用邮箱格式' },
          { name: '身份证', pattern: '^\\d{17}[\\dXx]$', desc: '18位身份证号' },
          { name: 'URL', pattern: '^https?://[\\w\\-]+(\\.[\\w\\-]+)+[/\\w\\-._~:?#@!$&\'()*+,;=%]*$', desc: 'HTTP/HTTPS URL' },
          { name: 'IP地址', pattern: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$', desc: 'IPv4地址' },
          { name: '日期', pattern: '^\\d{4}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\\d|3[01])$', desc: 'YYYY-MM-DD格式' },
          { name: '中文字符', pattern: '^[\\u4e00-\\u9fa5]+$', desc: '纯中文字符' },
          { name: '邮政编码', pattern: '^\\d{6}$', desc: '中国邮政编码' },
          { name: '车牌号', pattern: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-Z0-9]{5}$', desc: '普通车牌号' },
          { name: 'HTML标签', pattern: '<[^>]+>', desc: '匹配HTML标签' }
        ];
        $('#regexLibList').innerHTML = lib.map(function(item, i) {
          return '<div style="padding:10px;border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;" data-idx="' + i + '">' +
            '<div style="font-weight:600;">' + item.name + ' <span style="font-weight:normal;color:var(--text-secondary);font-size:12px;">' + item.desc + '</span></div>' +
            '<code style="font-size:12px;color:var(--primary-color);">' + escHtml(item.pattern) + '</code></div>';
        }).join('');
        $$('#regexLibList > div').forEach(function(el) {
          el.addEventListener('click', function() {
            var item = lib[parseInt(el.dataset.idx)];
            $('#regexLibOutput').textContent = item.name + ': ' + item.pattern + '\n说明: ' + item.desc;
          });
        });
        break;
      case 'chmodcalc':
        $('#chmodNum2Sym').addEventListener('click', function() {
          var num = $('#chmodNum').value.trim();
          if (!/^[0-7]{3,4}$/.test(num)) { $('#chmodOutput').textContent = '请输入3-4位八进制数'; return; }
          var digits = num.length === 4 ? num.slice(1) : num;
          function toSym(d) { return (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-'); }
          var sym = toSym(parseInt(digits[0])) + toSym(parseInt(digits[1])) + toSym(parseInt(digits[2]));
          $('#chmodOutput').textContent = num + ' → ' + sym + '\n所有者: ' + toSym(parseInt(digits[0])) + ' | 组: ' + toSym(parseInt(digits[1])) + ' | 其他: ' + toSym(parseInt(digits[2]));
        });
        $('#chmodSym2Num').addEventListener('click', function() {
          var sym = $('#chmodSym').value.trim();
          if (sym.length < 9) { $('#chmodOutput').textContent = '请输入9位符号(如rwxr-xr-x)'; return; }
          var full = (sym + '---------').slice(0, 9);
          function toNum(s) { return (s[0]==='r'?4:0) + (s[1]==='w'?2:0) + (s[2]==='x'?1:0); }
          var num = toNum(full.slice(0,3)).toString() + toNum(full.slice(3,6)).toString() + toNum(full.slice(6,9)).toString();
          $('#chmodOutput').textContent = sym + ' → ' + num;
        });
        break;
      case 'mime':
        var mimeMap = {
          '.html':'text/html','.htm':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.xml':'application/xml',
          '.txt':'text/plain','.md':'text/markdown','.csv':'text/csv','.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon',
          '.zip':'application/zip','.rar':'application/x-rar-compressed','.7z':'application/x-7z-compressed','.tar':'application/x-tar','.gz':'application/gzip',
          '.mp3':'audio/mpeg','.mp4':'video/mp4','.avi':'video/x-msvideo','.wav':'audio/wav','.flac':'audio/flac',
          '.py':'text/x-python','.java':'text/x-java-source','.c':'text/x-c','.cpp':'text/x-c++','.h':'text/x-c','.go':'text/x-go','.rs':'text/x-rust','.ts':'application/typescript',
          '.sh':'application/x-sh','.sql':'application/sql','.yaml':'application/x-yaml','.yml':'application/x-yaml','.toml':'application/toml',
          '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.eot':'application/vnd.ms-fontobject'
        };
        $('#mimeQuery').addEventListener('click', function() {
          var ext = $('#mimeExt').value.trim().toLowerCase();
          if (!ext) { $('#mimeOutput').textContent = '请输入扩展名'; return; }
          if (!ext.startsWith('.')) ext = '.' + ext;
          var mime = mimeMap[ext];
          $('#mimeOutput').textContent = mime ? ext + ' → ' + mime : '未找到 ' + ext + ' 的MIME类型';
        });
        break;
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function renderScripts(content) {
    loadAllData().then(function() {
      var d = appState.data;
      var canAdd = hasPermission('add');
      var canModify = hasPermission('modify');
      var canDelete = hasPermission('delete');
      var scripts = d.scripts || [];
      var selectedIds = [];

      var html = '<h2 class="page-title"><i class="fa-solid fa-file-code"></i> 脚本合集</h2>' +
        '<div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;">';
      if (canAdd) {
        html += '<button class="btn btn-primary" id="uploadScriptBtn"><i class="fa-solid fa-upload"></i> 上传脚本</button>';
      }
      html += '<button class="btn" id="batchDownloadBtn"><i class="fa-solid fa-download"></i> 批量下载</button>' +
        '<button class="btn" id="refreshScriptsBtn"><i class="fa-solid fa-rotate"></i> 刷新</button>' +
        '</div>';

      if (scripts.length === 0) {
        html += '<div class="empty-state"><i class="fa-solid fa-file-circle-question"></i><p>暂无脚本，点击上传按钮添加</p></div>';
      } else {
        html += '<div class="table-wrapper"><table class="data-table">' +
          '<thead><tr>' +
          '<th><input type="checkbox" id="selectAllScripts"></th>' +
          '<th>名称</th><th>大小</th><th>上传者</th><th>上传时间</th><th>操作</th>' +
          '</tr></thead><tbody>';
        scripts.forEach(function(s) {
          html += '<tr>' +
            '<td><input type="checkbox" class="script-check" data-id="' + s.id + '"></td>' +
            '<td><i class="fa-solid fa-file-code" style="color:var(--primary-color);"></i> ' + escHtml(s.name) + '</td>' +
            '<td>' + formatFileSize(s.size || 0) + '</td>' +
            '<td>' + escHtml(s.uploaded_by || '-') + '</td>' +
            '<td>' + formatDate(s.uploaded_at) + '</td>' +
            '<td>' +
              '<a href="/api/scripts/' + s.id + '/download?token=' + encodeURIComponent(appState.authToken || '') + '" class="btn btn-sm"><i class="fa-solid fa-download"></i> 下载</a>' +
              (canModify ? ' <button class="btn btn-sm edit-script-btn" data-id="' + s.id + '" data-name="' + escHtml(s.name) + '" data-desc="' + escHtml(s.description || '') + '"><i class="fa-solid fa-pen"></i></button>' : '') +
              (canDelete ? ' <button class="btn btn-sm btn-danger delete-script-btn" data-id="' + s.id + '"><i class="fa-solid fa-trash"></i></button>' : '') +
            '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
      }
      content.innerHTML = html;

      var uploadBtn = $('#uploadScriptBtn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
          var bodyHtml = '<div class="form-group"><label>选择脚本文件</label><input type="file" id="scriptFile" required></div>' +
            '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveScriptBtn"><i class="fa-solid fa-check"></i> 上传</button></div>';
          showModal('上传脚本', bodyHtml);
          $('#saveScriptBtn').addEventListener('click', function() {
            var fileInput = $('#scriptFile');
            if (!fileInput.files || !fileInput.files[0]) { toast('请选择文件', 'error'); return; }
            var formData = new FormData();
            formData.append('file', fileInput.files[0]);
            var btn = this;
            btn.disabled = true; btn.textContent = '上传中...';
            fetch('/api/scripts/upload', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + appState.authToken },
              body: formData
            }).then(function(res) { return res.json(); }).then(function() {
              toast('上传成功', 'success');
              closeModal();
              renderRoute('scripts');
            }).catch(function() {
              toast('上传失败', 'error');
              btn.disabled = false; btn.textContent = '上传';
            });
          });
        });
      }

      var refreshBtn = $('#refreshScriptsBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function() { invalidateDataCache(); renderRoute('scripts'); });
      }

      var selectAll = $('#selectAllScripts');
      if (selectAll) {
        selectAll.addEventListener('change', function() {
          $$('.script-check').forEach(function(cb) { cb.checked = selectAll.checked; });
        });
      }

      var batchBtn = $('#batchDownloadBtn');
      if (batchBtn) {
        batchBtn.addEventListener('click', function() {
          var ids = [];
          $$('.script-check:checked').forEach(function(cb) { ids.push(parseInt(cb.dataset.id)); });
          if (ids.length === 0) { toast('请先勾选要下载的脚本', 'error'); return; }
          fetch('/api/scripts/batch-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + appState.authToken },
            body: JSON.stringify(ids)
          }).then(function(res) { return res.blob(); }).then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'scripts.zip';
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            toast('下载成功', 'success');
          }).catch(function() { toast('下载失败', 'error'); });
        });
      }

      $$('.edit-script-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = btn.dataset.id;
          var name = btn.dataset.name;
          var desc = btn.dataset.desc;
          var bodyHtml =
            '<div class="form-group"><label>脚本名称</label><input type="text" id="editScriptName" value="' + escHtml(name) + '"></div>' +
            '<div class="form-group"><label>描述</label><input type="text" id="editScriptDesc" value="' + escHtml(desc) + '"></div>' +
            '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveEditScriptBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';
          showModal('编辑脚本', bodyHtml);
          $('#saveEditScriptBtn').addEventListener('click', function() {
            apiFetch('/scripts/' + id, {
              method: 'PUT',
              body: JSON.stringify({ name: $('#editScriptName').value.trim(), description: $('#editScriptDesc').value.trim() })
            }).then(function() {
              toast('已更新', 'success');
              closeModal();
              renderRoute('scripts');
            }).catch(function(err) { toast('更新失败: ' + err.message, 'error'); });
          });
        });
      });

      $$('.delete-script-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = btn.dataset.id;
          if (confirm('确定删除该脚本吗？')) {
            apiFetch('/scripts/' + id, { method: 'DELETE' }).then(function() {
              toast('已删除', 'success');
              renderRoute('scripts');
            }).catch(function(err) { toast('删除失败: ' + err.message, 'error'); });
          }
        });
      });
    });
  }

  function renderPrograms(content) {
    loadAllData().then(function() {
      var d = appState.data;
      var canAdd = hasPermission('add');
      var canModify = hasPermission('modify');
      var canDelete = hasPermission('delete');
      var programs = d.programs || [];
      var categories = d.programCategories || ['脚本', '服务', '配置', '工具'];
      var selectedIds = [];
      var currentUserId = appState.currentUser ? appState.currentUser.id : 0;
      var isSuperadmin = appState.currentUser && appState.currentUser.role === 'superadmin';

      var html = '<h2 class="page-title"><i class="fa-solid fa-cube"></i> 自研程序</h2>' +
        '<div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">';
      if (canAdd) {
        html += '<button class="btn btn-primary" id="uploadProgramBtn"><i class="fa-solid fa-upload"></i> 上传程序</button>';
      }
      html += '<button class="btn" id="batchDownloadProgramsBtn"><i class="fa-solid fa-download"></i> 批量下载</button>' +
        '<button class="btn" id="refreshProgramsBtn"><i class="fa-solid fa-rotate"></i> 刷新</button>' +
        '<input type="text" id="programSearch" placeholder="搜索程序名称..." style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;">' +
        '<select id="programCategoryFilter" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;"><option value="">全部分类</option><option value="未分类">未分类</option>';
      categories.forEach(function(c) {
        html += '<option value="' + escHtml(c) + '">' + escHtml(c) + '</option>';
      });
      html += '</select></div>';

      function renderProgramTable(list) {
        if (list.length === 0) {
          return '<div class="empty-state"><i class="fa-solid fa-cube"></i><p>暂无程序，点击上传按钮添加</p></div>';
        }
        var tableHtml = '<div class="table-wrapper"><table class="data-table">' +
          '<thead><tr>' +
          '<th><input type="checkbox" id="selectAllPrograms"></th>' +
          '<th>名称</th><th>版本</th><th>分类</th><th>适用环境</th><th>大小</th><th>上传者</th><th>下载次数</th><th>上传时间</th><th>操作</th>' +
          '</tr></thead><tbody>';
        list.forEach(function(p) {
          var envsText = (p.envs || []).join(', ') || '-';
          var canEditThis = canModify && (p.uploader_id === currentUserId || isSuperadmin);
          var canDeleteThis = canDelete && (p.uploader_id === currentUserId || isSuperadmin);
          tableHtml += '<tr>' +
            '<td><input type="checkbox" class="program-check" data-id="' + p.id + '"></td>' +
            '<td><i class="fa-solid fa-cube" style="color:var(--primary-color);"></i> ' + escHtml(p.name) +
              (p.description ? '<div style="font-size:12px;color:#888;">' + escHtml(p.description) + '</div>' : '') + '</td>' +
            '<td><span class="badge">' + escHtml(p.version || '-') + '</span></td>' +
            '<td>' + escHtml(p.category || '-') + '</td>' +
            '<td>' + escHtml(envsText) + '</td>' +
            '<td>' + formatFileSize(p.file_size || 0) + '</td>' +
            '<td>' + escHtml(p.uploader_name || '-') + '</td>' +
            '<td>' + (p.download_count || 0) + '</td>' +
            '<td>' + formatDate(p.created_at) + '</td>' +
            '<td>' +
              '<a href="/api/programs/' + p.id + '/download?token=' + encodeURIComponent(appState.authToken || '') + '" class="btn btn-sm"><i class="fa-solid fa-download"></i> 下载</a>' +
              (canEditThis ? ' <button class="btn btn-sm edit-program-btn" data-id="' + p.id + '"><i class="fa-solid fa-pen"></i></button>' : '') +
              (canDeleteThis ? ' <button class="btn btn-sm btn-danger delete-program-btn" data-id="' + p.id + '"><i class="fa-solid fa-trash"></i></button>' : '') +
            '</td>' +
          '</tr>';
        });
        tableHtml += '</tbody></table></div>';
        return tableHtml;
      }

      content.innerHTML = html + '<div id="programListContainer">' + renderProgramTable(programs) + '</div>';

      function getFilteredPrograms() {
        var kw = $('#programSearch').value.trim().toLowerCase();
        var cat = $('#programCategoryFilter').value;
        return programs.filter(function(p) {
          if (cat && p.category !== cat) return false;
          if (kw && (p.name || '').toLowerCase().indexOf(kw) === -1) return false;
          return true;
        });
      }

      function refreshTable() {
        $('#programListContainer').innerHTML = renderProgramTable(getFilteredPrograms());
        bindRowEvents();
      }

      function bindRowEvents() {
        var selectAll = $('#selectAllPrograms');
        if (selectAll) {
          selectAll.addEventListener('change', function() {
            $$('.program-check').forEach(function(cb) { cb.checked = selectAll.checked; });
          });
        }
        $$('.edit-program-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var id = parseInt(btn.dataset.id);
            var p = programs.find(function(x) { return x.id === id; });
            if (!p) return;
            var envsStr = (p.envs || []).join(', ');
            var editCatOptions = '<option value="未分类">未分类</option>' + categories.map(function(c) {
              var sel = (p.category === c) ? ' selected' : '';
              return '<option value="' + escHtml(c) + '"' + sel + '>' + escHtml(c) + '</option>';
            }).join('');
            var bodyHtml =
              '<div class="form-group"><label>程序名称</label><input type="text" id="editProgName" value="' + escHtml(p.name) + '"></div>' +
              '<div class="form-group"><label>版本号</label><input type="text" id="editProgVersion" value="' + escHtml(p.version || '') + '"></div>' +
              '<div class="form-group"><label>分类</label><select id="editProgCategory">' + editCatOptions + '</select></div>' +
              '<div class="form-group"><label>适用环境 (逗号分隔)</label><input type="text" id="editProgEnvs" value="' + escHtml(envsStr) + '"></div>' +
              '<div class="form-group"><label>描述</label><textarea id="editProgDesc" rows="2">' + escHtml(p.description || '') + '</textarea></div>' +
              '<div class="form-group"><label>依赖说明</label><textarea id="editProgDeps" rows="2">' + escHtml(p.dependencies || '') + '</textarea></div>' +
              '<div class="form-group"><label>使用命令</label><input type="text" id="editProgCmd" value="' + escHtml(p.usage_cmd || '') + '"></div>' +
              '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveEditProgBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';
            showModal('编辑程序 - ' + p.name, bodyHtml);
            $('#saveEditProgBtn').addEventListener('click', function() {
              var envsRaw = $('#editProgEnvs').value.replace(/[，、]/g, ',');
              var envsArr = envsRaw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
              apiFetch('/programs/' + id, {
                method: 'PUT',
                body: JSON.stringify({
                  name: $('#editProgName').value.trim(),
                  version: $('#editProgVersion').value.trim(),
                  category: $('#editProgCategory').value.trim(),
                  envs: envsArr,
                  description: $('#editProgDesc').value.trim(),
                  dependencies: $('#editProgDeps').value.trim(),
                  usage_cmd: $('#editProgCmd').value.trim()
                })
              }).then(function() {
                toast('已更新', 'success');
                closeModal();
                renderRoute('programs');
              }).catch(function(err) { toast('更新失败: ' + err.message, 'error'); });
            });
          });
        });
        $$('.delete-program-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var id = btn.dataset.id;
            if (confirm('确定删除该程序吗？关联文件也会被删除。')) {
              apiFetch('/programs/' + id, { method: 'DELETE' }).then(function() {
                toast('已删除', 'success');
                renderRoute('programs');
              }).catch(function(err) { toast('删除失败: ' + err.message, 'error'); });
            }
          });
        });
      }

      bindRowEvents();

      var uploadBtn = $('#uploadProgramBtn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
          var catOptions = categories.map(function(c) { return '<option value="' + escHtml(c) + '">' + escHtml(c) + '</option>'; }).join('');
          var bodyHtml =
            '<div class="form-group"><label>选择程序文件</label><input type="file" id="programFile" required></div>' +
            '<div class="form-group"><label>程序名称</label><input type="text" id="programName" placeholder="如：xxx工具"></div>' +
            '<div class="form-group"><label>版本号</label><input type="text" id="programVersion" placeholder="如：v1.2.3"></div>' +
            '<div class="form-group"><label>分类</label><select id="programCategory"><option value="未分类">未分类</option>' + catOptions + '</select></div>' +
            '<div class="form-group"><label>适用环境 (逗号分隔)</label><input type="text" id="programEnvs" placeholder="如：106,139"></div>' +
            '<div class="form-group"><label>描述</label><textarea id="programDesc" rows="2"></textarea></div>' +
            '<div class="form-group"><label>依赖说明</label><textarea id="programDeps" rows="2"></textarea></div>' +
            '<div class="form-group"><label>使用命令</label><input type="text" id="programCmd" placeholder="如：python main.py"></div>' +
            '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveProgramBtn"><i class="fa-solid fa-check"></i> 上传</button></div>';
          showModal('上传程序', bodyHtml);
          var fileInput = $('#programFile');
          var nameInput = $('#programName');
          fileInput.addEventListener('change', function() {
            if (fileInput.files[0] && !nameInput.value.trim()) {
              var fn = fileInput.files[0].name;
              nameInput.value = fn.replace(/\.[^.]+$/, '');
            }
          });
          $('#saveProgramBtn').addEventListener('click', function() {
            var fileInput2 = $('#programFile');
            if (!fileInput2.files || !fileInput2.files[0]) { toast('请选择文件', 'error'); return; }
            var nameVal = $('#programName').value.trim();
            var versionVal = $('#programVersion').value.trim();
            var envsRaw = $('#programEnvs').value.replace(/[，、]/g, ',');
            var envsArr = envsRaw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
            var formData = new FormData();
            formData.append('file', fileInput2.files[0]);
            formData.append('name', nameVal);
            formData.append('version', versionVal);
            formData.append('category', $('#programCategory').value || '未分类');
            formData.append('envs', JSON.stringify(envsArr));
            formData.append('description', $('#programDesc').value.trim());
            formData.append('dependencies', $('#programDeps').value.trim());
            formData.append('usage_cmd', $('#programCmd').value.trim());
            var btn = this;
            btn.disabled = true; btn.textContent = '上传中...';
            apiFetch('/programs/upload', {
              method: 'POST',
              body: formData
            }).then(function(res) {
              if (res && res.id) {
                toast('上传成功', 'success');
                closeModal();
                renderRoute('programs');
              } else {
                toast('上传失败: ' + (res.detail || '未知错误'), 'error');
                btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> 上传';
              }
            }).catch(function(err) {
              toast('上传失败: ' + err.message, 'error');
              btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> 上传';
            });
          });
        });
      }

      $('#refreshProgramsBtn').addEventListener('click', function() { renderRoute('programs'); });

      $('#programSearch').addEventListener('input', function() { refreshTable(); });
      $('#programCategoryFilter').addEventListener('change', function() { refreshTable(); });

      $('#batchDownloadProgramsBtn').addEventListener('click', function() {
        var ids = [];
        $$('.program-check:checked').forEach(function(cb) { ids.push(parseInt(cb.dataset.id)); });
        if (ids.length === 0) { toast('请先勾选要下载的程序', 'error'); return; }
        fetch('/api/programs/batch-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + appState.authToken },
          body: JSON.stringify(ids)
        }).then(function(res) { return res.blob(); }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'programs.zip';
          document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(url);
          toast('下载成功', 'success');
        }).catch(function() { toast('下载失败', 'error'); });
      });
    });
  }

  function renderFavorites(content) {
    loadAllData().then(function() {
      var d = appState.data;
      var favEnvs = d.envs.filter(function(e) { return d.favorites.envs && d.favorites.envs.indexOf(e.id) !== -1; });
      var favTools = d.tools.filter(function(t) { return d.favorites.tools && d.favorites.tools.indexOf(t.id) !== -1; });
      var favToolboxIds = d.favorites.toolbox || [];
      var favToolbox = allToolboxTools.filter(function(t) { return favToolboxIds.indexOf(t.id) !== -1; });
      var quickEntries = d.quickEntries || [];
      var canAdd = !!appState.currentUser;
      var canDelete = !!appState.currentUser;
      var canManage = hasPermission('delete');

      var envFavs = favEnvs.map(function(e) { return { type: 'env', id: e.id, icon: 'fa-solid fa-server', name: e.name, data: e }; });
      var toolFavs = favTools.map(function(t) {
        var iconHtml = t.icon && (t.icon.startsWith('/icons/') || t.icon.startsWith('http')) 
          ? t.icon 
          : t.icon || 'fa-solid fa-gear';
        return { type: 'tool', id: t.id, icon: iconHtml, name: t.name, data: t, isImage: t.icon && (t.icon.startsWith('/icons/') || t.icon.startsWith('http')) };
      });
      var toolboxFavs = favToolbox.map(function(t) { return { type: 'toolbox', id: t.id, icon: t.icon, name: t.name, data: t }; });

      var sections = [];
      if (envFavs.length > 0) {
        sections.push({
          title: '网址大全',
          icon: 'fa-solid fa-earth-asia',
          color: '#3b82f6',
          badge: '环境',
          items: envFavs
        });
      }
      if (toolFavs.length > 0) {
        sections.push({
          title: '软件管家',
          icon: 'fa-solid fa-screwdriver-wrench',
          color: '#8b5cf6',
          badge: '软件',
          items: toolFavs
        });
      }
      if (toolboxFavs.length > 0) {
        sections.push({
          title: '工具箱',
          icon: 'fa-solid fa-toolbox',
          color: '#10b981',
          badge: '工具',
          items: toolboxFavs
        });
      }

      var totalCount = envFavs.length + toolFavs.length + toolboxFavs.length;

      content.innerHTML = '<div class="favorites-page">' +
        '<div class="page-header">' +
          '<h2 class="page-title"><i class="fa-solid fa-star" style="color:#f59e0b;"></i> 我的收藏</h2>' +
        '</div>';

      if (totalCount === 0) {
        content.innerHTML += '<div class="fav-welcome-card">' +
          '<div class="fav-welcome-icon"><i class="fa-regular fa-star"></i></div>' +
          '<h3>暂无收藏</h3>' +
          '<p>在各页面中点击 <i class="fa-solid fa-star" style="color:#f59e0b;"></i> 星标按钮<br>将常用的环境、软件、工具添加到这里</p>' +
        '</div>';
      } else {
        sections.forEach(function(section) {
          content.innerHTML += '<div class="fav-section">' +
            '<div class="fav-section-header">' +
              '<h3><i class="' + section.icon + '" style="color:' + section.color + ';"></i> ' + escHtml(section.title) + '</h3>' +
              '<span class="fav-count-badge">' + section.items.length + '</span>' +
            '</div>' +
            '<div class="favorites-grid">' +
              section.items.map(function(f) {
                return '<div class="fav-card" draggable="' + (f.type !== 'toolbox' ? 'true' : 'false') + '" data-type="' + f.type + '" data-id="' + f.id + '">' +
                  '<button class="fav-card-remove" data-type="' + f.type + '" data-id="' + f.id + '" title="取消收藏"><i class="fa-solid fa-xmark"></i></button>' +
                  '<div class="fav-card-icon ' + (f.isImage ? 'is-image' : '') + '">' +
                    (f.isImage ? '<img src="' + escHtml(f.icon) + '" alt="">' : '<i class="' + escHtml(f.icon) + '"></i>') +
                  '</div>' +
                  '<div class="fav-card-name">' + escHtml(f.name) + '</div>' +
                  '<div class="fav-card-badge">' + section.badge + '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>';
        });
      }

      content.innerHTML += '</div>';

      bindFavoritesEvents();
    });
  }

  function bindFavoritesEvents() {
    var favItems = $$('.fav-card');
    var draggedItem = null;

    favItems.forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.fav-card-remove')) return;
        var type = item.dataset.type;
        if (type === 'env') {
          var id = parseInt(item.dataset.id);
          var env = appState.data.envs.find(function(e) { return e.id === id; });
          if (env) {
            addHistory('env', id);
            window.open(buildEnvUrl(env), '_blank');
          }
        } else if (type === 'tool') {
          var id = parseInt(item.dataset.id);
          var tool = appState.data.tools.find(function(t) { return t.id === id; });
          if (tool) {
            addHistory('tool', id);
            showToolDetail(tool);
          }
        } else if (type === 'toolbox') {
          openToolboxTool(item.dataset.id);
        }
      });

      item.addEventListener('dragstart', function(e) {
        if (item.dataset.type === 'toolbox') return;
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        $$('.fav-card').forEach(function(el) { el.classList.remove('drag-over'); });
        draggedItem = null;
      });

      item.addEventListener('dragover', function(e) {
        if (item.dataset.type === 'toolbox' || !draggedItem || draggedItem.dataset.type === 'toolbox') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== draggedItem) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', function(e) {
        if (item.dataset.type === 'toolbox' || !draggedItem || draggedItem.dataset.type === 'toolbox') return;
        e.preventDefault();
        item.classList.remove('drag-over');
        if (draggedItem && draggedItem !== item) {
          var grid = $('#favGrid');
          var items = Array.from(grid.querySelectorAll('.fav-card'));
          var fromIdx = items.indexOf(draggedItem);
          var toIdx = items.indexOf(item);
          if (fromIdx < toIdx) {
            grid.insertBefore(draggedItem, item.nextSibling);
          } else {
            grid.insertBefore(draggedItem, item);
          }
          var order = Array.from(grid.querySelectorAll('.fav-card')).map(function(el) {
            var val = el.dataset.type === 'env' || el.dataset.type === 'tool' ? parseInt(el.dataset.id) : el.dataset.id;
            return { type: el.dataset.type, id: val };
          });
          saveLocalSetting('favOrder', JSON.stringify(order));
        }
      });
    });

    $$('.fav-card-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var type = btn.dataset.type;
        var id = type === 'toolbox' ? btn.dataset.id : parseInt(btn.dataset.id);
        toggleFavorite(type, id, null);
      });
    });

    $$('.quick-entry-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.fav-card-remove')) return;
        var entryId = parseInt(item.dataset.entryId);
        var entry = (appState.data.quickEntries || []).find(function(e) { return e.id === entryId; });
        if (entry && entry.url) {
          window.open(entry.url, '_blank');
        }
      });
    });

    $$('.quick-entry-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var entryId = parseInt(btn.dataset.entryId);
        if (confirm('确定要删除该收藏吗？')) {
          apiFetch('/quick-entries/' + entryId, { method: 'DELETE' }).then(function() {
            toast('收藏已删除', 'success');
            renderRoute('favorites');
          }).catch(function(err) {
            toast('删除失败: ' + err.message, 'error');
          });
        }
      });
    });

    var addBtn = $('#addQuickEntryBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        showQuickEntryAddModal();
      });
    }
  }

  function showQuickEntryAddModal() {
    var bodyHtml =
      '<div class="form-group"><label>名称</label><input type="text" id="qeName" placeholder="入口名称" required></div>' +
      '<div class="form-group"><label>URL</label><input type="text" id="qeUrl" placeholder="https://..." required></div>' +
      '<div class="form-group"><label>图标 (FontAwesome类名)</label><input type="text" id="qeIcon" value="fa-solid fa-link" placeholder="如 fa-solid fa-link"></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="qeDesc" placeholder="描述（可选）"></div>' +
      '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveQeBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';

    showModal('添加收藏', bodyHtml);
    initIconSelector('qeIcon');

    $('#saveQeBtn').addEventListener('click', function() {
      var data = {
        name: $('#qeName').value.trim(),
        url: $('#qeUrl').value.trim(),
        icon: $('#qeIcon').value.trim() || 'fa-solid fa-link',
        description: $('#qeDesc').value.trim()
      };
      if (!data.name || !data.url) { toast('请填写名称和URL', 'error'); return; }
      apiFetch('/quick-entries', { method: 'POST', body: JSON.stringify(data) }).then(function() {
        toast('收藏已添加', 'success');
        closeModal();
        renderRoute('favorites');
      }).catch(function(err) {
        toast('添加失败: ' + err.message, 'error');
      });
    });
  }

  function renderUsers(content) {
    if (!appState.currentUser || appState.currentUser.role !== 'superadmin') {
      content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><p>仅超级管理员可访问此页面</p></div>';
      return;
    }

    apiFetch('/users').then(function(users) {
      apiFetch('/users/grants').then(function(grants) {
        content.innerHTML = '<h2 class="page-title">👥 用户管理</h2>' +
          '<div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;">' +
            '<button class="btn btn-primary" id="addUserBtn"><i class="fa-solid fa-user-plus"></i> 添加用户</button>' +
            '<button class="btn" id="refreshUsersBtn"><i class="fa-solid fa-rotate"></i> 刷新</button>' +
          '</div>' +
          '<div class="table-wrapper" style="max-height:none;">' +
              '<table class="data-table">' +
                '<thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>所属组</th><th>角色</th><th>页面权限</th><th>操作权限</th><th>操作</th></tr></thead>' +
                '<tbody>' +
                  users.map(function(u) {
                    var perms = (u.permissions || []).join(', ');
                    var pages = u.pages || ['home','urls','favorites'];
                    var pagesText = u.role === 'superadmin' ? '全部页面' : pages.map(function(p) { return PAGE_CONFIG[p] ? PAGE_CONFIG[p].name : p; }).join(', ');
                    var cg = u.company_group || 'general';
                    var cgs = u.company_groups || [];
                    if (cg !== 'general' && cgs.indexOf(cg) === -1) cgs = [cg].concat(cgs);
                    var groupBadges;
                    if (cgs.length === 0) {
                      groupBadges = '<span class="badge" style="background:#f1f5f9;color:#475569;">通用软件</span>';
                    } else {
                      groupBadges = cgs.map(function(gid) {
                        var color = getCompanyGroupColor(gid);
                        return '<span class="badge" style="background:' + color + '15;color:' + color + ';border:1px solid ' + color + '40;margin:1px;">' + escHtml(getCompanyGroupName(gid)) + '</span>';
                      }).join('');
                    }
                    return '<tr>' +
                      '<td>' + u.id + '</td>' +
                      '<td>' + escHtml(u.username) + '</td>' +
                      '<td>' + escHtml(u.display_name || '-') + '</td>' +
                      '<td style="max-width:250px;">' + groupBadges + '</td>' +
                      '<td>' + (u.role === 'superadmin' ? '<span class="badge badge-admin">超级管理员</span>' : '<span class="badge badge-user">普通用户</span>') + '</td>' +
                      '<td style="font-size:12px;">' + escHtml(pagesText) + '</td>' +
                      '<td>' + escHtml(perms || '无') + '</td>' +
                      '<td>' +
                        '<button class="btn btn-sm edit-user-btn" data-user-id="' + u.id + '" data-username="' + escHtml(u.username) + '" data-display-name="' + escHtml(u.display_name || '') + '" data-role="' + u.role + '" data-perms="' + escHtml(perms) + '" data-pages="' + escHtml(pages.join(',')) + '" data-company-group="' + escHtml(cg) + '" data-company-groups="' + escHtml(cgs.join(',')) + '"><i class="fa-solid fa-pen-to-square"></i> 编辑</button>' +
                        (u.role !== 'superadmin' ? '<button class="btn btn-sm btn-danger delete-user-btn" data-user-id="' + u.id + '"><i class="fa-solid fa-trash"></i> 删除</button>' +
                        '<button class="btn btn-sm grant-user-btn" data-user-id="' + u.id + '" data-username="' + escHtml(u.username) + '"><i class="fa-solid fa-clock"></i> 授权</button>' : '') +
                      '</td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>' +
          (grants.length > 0 ?
          '<div class="dashboard-section">' +
            '<h3>当前有效授权</h3>' +
            '<div class="table-wrapper">' +
              '<table class="data-table">' +
                '<thead><tr><th>用户ID</th><th>权限</th><th>过期时间</th><th>操作</th></tr></thead>' +
                '<tbody>' +
                  grants.map(function(g, idx) {
                    return '<tr>' +
                      '<td>' + g.user_id + '</td>' +
                      '<td>' + (g.permissions || []).join(', ') + '</td>' +
                      '<td>' + formatDate(g.expires) + '</td>' +
                      '<td><button class="btn btn-sm btn-danger revoke-grant-btn" data-grant-idx="' + idx + '"><i class="fa-solid fa-xmark"></i> 收回</button></td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' : '');

        bindUsersEvents();
      }).catch(function() { toast('加载授权失败', 'error'); });
    }).catch(function() { toast('加载用户失败', 'error'); });
  }

  function buildPageCheckboxes(selectedPages) {
    var order = (appState.data.menuOrder && appState.data.menuOrder.length > 0) ? appState.data.menuOrder : DEFAULT_MENU_ORDER;
    var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    order.forEach(function(route) {
      if (!PAGE_CONFIG[route]) return;
      var checked = selectedPages.indexOf(route) !== -1 ? ' checked' : '';
      html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">' +
        '<input type="checkbox" class="page-check" value="' + route + '"' + checked + ' style="margin:0;"> ' + PAGE_CONFIG[route].name + '</label>';
    });
    html += '</div>';
    return html;
  }

  var ALL_COMPANY_GROUPS = [
    {"id": "general", "name": "通用软件"},
    {"id": "system", "name": "系统组"},
    {"id": "cloud_platform", "name": "云端平台组"},
    {"id": "perception", "name": "感知组"},
    {"id": "control", "name": "规控组"},
    {"id": "calibration", "name": "标定组"},
    {"id": "map", "name": "地图组"},
    {"id": "vehicle_platform", "name": "车端平台组"},
    {"id": "hardware", "name": "智能硬件集成组"},
    {"id": "simulation", "name": "仿真组"},
    {"id": "quality", "name": "质量组"},
    {"id": "tech_support", "name": "技术支持组"},
    {"id": "pm", "name": "研发项目管理组"}
  ];

  function getCompanyGroupName(groupId) {
    var g = ALL_COMPANY_GROUPS.find(function(x) { return x.id === groupId; });
    return g ? g.name : groupId;
  }

  function getCompanyGroupColor(groupId) {
    var colors = {
      "general": "#64748b",
      "system": "#3b82f6",
      "cloud_platform": "#ef4444",
      "perception": "#f59e0b",
      "control": "#eab308",
      "calibration": "#84cc16",
      "map": "#06b6d4",
      "vehicle_platform": "#8b5cf6",
      "hardware": "#d97706",
      "simulation": "#8b5cf6",
      "quality": "#14b8a6",
      "tech_support": "#0ea5e9",
      "pm": "#f97316"
    };
    return colors[groupId] || "#64748b";
  }

  function buildCompanyGroupSelect(selectedId, selectId) {
    var html = '<select id="' + selectId + '" class="form-control">';
    ALL_COMPANY_GROUPS.forEach(function(g) {
      var selected = g.id === selectedId ? ' selected' : '';
      html += '<option value="' + g.id + '"' + selected + '>' + g.name + '</option>';
    });
    html += '</select>';
    return html;
  }

  function buildCompanyGroupCheckboxes(selectedIds, containerId) {
    var html = '<div id="' + containerId + '" style="display:flex;flex-wrap:wrap;gap:6px;">';
    ALL_COMPANY_GROUPS.filter(function(g) { return g.id !== "general"; }).forEach(function(g) {
      var checked = selectedIds.indexOf(g.id) !== -1 ? ' checked' : '';
      var color = getCompanyGroupColor(g.id);
      html += '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:4px 8px;border:1px solid ' + (checked ? color : 'var(--border-color)') + ';border-radius:6px;font-size:12px;background:' + (checked ? color + '15' : 'transparent') + ';">' +
        '<input type="checkbox" class="company-group-check" value="' + g.id + '"' + checked + ' style="margin:0;"> ' + g.name + '</label>';
    });
    html += '</div>';
    return html;
  }

  function getCompanyGroupNames(groupIds) {
    return groupIds.map(function(id) { return getCompanyGroupName(id); }).join('、');
  }

  function bindUsersEvents() {
    var refreshBtn = $('#refreshUsersBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() { renderRoute('users'); });
    }
    var addBtn = $('#addUserBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var defaultPages = DEFAULT_USER_PAGES.slice();
        var bodyHtml =
          '<div class="form-group"><label>用户名 (登录账号)</label><input type="text" id="newUsername" placeholder="如: m*.*l@***********" required></div>' +
          '<div class="form-group"><label>姓名 (中文显示名)</label><input type="text" id="newDisplayName" placeholder="如: 林谋"></div>' +
          '<div class="form-group"><label>密码</label><input type="password" id="newPassword" placeholder="密码" required></div>' +
          '<div class="form-group"><label>主组</label>' + buildCompanyGroupSelect('general', 'newCompanyGroup') + '</div>' +
          '<div class="form-group"><label>附加访问组（可多选）</label>' + buildCompanyGroupCheckboxes([], 'newCompanyGroupsChecks') + '</div>' +
          '<div class="form-group"><label>角色</label><select id="newRole"><option value="user">普通用户</option><option value="superadmin">超级管理员</option></select></div>' +
          '<div class="form-group" id="newPagePerms"><label>页面权限</label>' + buildPageCheckboxes(defaultPages) + '</div>' +
          '<div class="form-group"><label>操作权限 (逗号分隔: add,delete,view,modify)</label><input type="text" id="newPerms" value="view" placeholder="view"></div>' +
          '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveUserBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';
        showModal('添加用户', bodyHtml);
        var newRoleSelect = $('#newRole');
        var newPagePerms = $('#newPagePerms');
        function toggleNewPagePerms() {
          var isSa = newRoleSelect.value === 'superadmin';
          if (isSa) {
            newPagePerms.innerHTML = '<label>页面权限</label><p style="color:var(--text-secondary);font-size:13px;">超级管理员拥有全部页面权限</p>';
          } else {
            newPagePerms.innerHTML = '<label>页面权限</label>' + buildPageCheckboxes(defaultPages);
          }
        }
        newRoleSelect.addEventListener('change', toggleNewPagePerms);
        $('#saveUserBtn').addEventListener('click', function() {
          var isSa = newRoleSelect.value === 'superadmin';
          var primaryGroup = $('#newCompanyGroup').value;
          var additionalGroups = [];
          $$('#newCompanyGroupsChecks .company-group-check:checked').forEach(function(cb) {
            if (cb.value !== primaryGroup) additionalGroups.push(cb.value);
          });
          var data = {
            username: $('#newUsername').value.trim(),
            display_name: $('#newDisplayName').value.trim(),
            password: $('#newPassword').value,
            company_group: primaryGroup,
            company_groups: additionalGroups,
            role: newRoleSelect.value,
            permissions: $('#newPerms').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
          };
          if (!isSa) {
            var pages = [];
            newPagePerms.querySelectorAll('.page-check:checked').forEach(function(cb) { pages.push(cb.value); });
            data.pages = pages;
          }
          if (!data.username || !data.password) { toast('请填写用户名和密码', 'error'); return; }
          apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }).then(function() {
            toast('用户已创建', 'success');
            closeModal();
            renderRoute('users');
          }).catch(function(err) { toast('创建失败: ' + err.message, 'error'); });
        });
      });
    }
    $$('.edit-user-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var uid = parseInt(btn.dataset.userId);
        var uname = btn.dataset.username;
        var dname = btn.dataset.displayName || '';
        var role = btn.dataset.role;
        var perms = btn.dataset.perms;
        var cg = btn.dataset.companyGroup || 'general';
        var cgs = btn.dataset.companyGroups ? btn.dataset.companyGroups.split(',').filter(Boolean) : [];
        if (cg !== 'general' && cgs.indexOf(cg) === -1) cgs = [cg].concat(cgs);
        var additionalGroups = cgs.filter(function(g) { return g !== cg; });
        var userPages = btn.dataset.pages ? btn.dataset.pages.split(',') : DEFAULT_USER_PAGES.slice();
        var bodyHtml =
          '<div class="form-group"><label>用户名 (登录账号)</label><input type="text" id="editUsername" value="' + escHtml(uname) + '" required></div>' +
          '<div class="form-group"><label>姓名 (中文显示名)</label><input type="text" id="editDisplayName" value="' + escHtml(dname) + '" placeholder="如: 焦宁"></div>' +
          '<div class="form-group"><label>新密码 (留空不修改)</label><input type="password" id="editPassword" placeholder="留空则不修改密码"></div>' +
          '<div class="form-group"><label>主组</label>' + buildCompanyGroupSelect(cg, 'editCompanyGroup') + '</div>' +
          '<div class="form-group"><label>附加访问组（可多选）</label>' + buildCompanyGroupCheckboxes(additionalGroups, 'editCompanyGroupsChecks') + '</div>' +
          '<div class="form-group"><label>角色</label><select id="editRole"><option value="user"' + (role === 'user' ? ' selected' : '') + '>普通用户</option><option value="superadmin"' + (role === 'superadmin' ? ' selected' : '') + '>超级管理员</option></select></div>' +
          '<div class="form-group" id="editPagePerms">' + (role === 'superadmin' ? '<label>页面权限</label><p style="color:var(--text-secondary);font-size:13px;">超级管理员拥有全部页面权限</p>' : '<label>页面权限</label>' + buildPageCheckboxes(userPages)) + '</div>' +
          '<div class="form-group"><label>操作权限 (逗号分隔)</label><input type="text" id="editPerms" value="' + escHtml(perms) + '"></div>' +
          '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveEditUserBtn"><i class="fa-solid fa-check"></i> 保存</button></div>';
        showModal('编辑用户', bodyHtml);
        var editRoleSelect = $('#editRole');
        var editPagePerms = $('#editPagePerms');
        function toggleEditPagePerms() {
          var isSa = editRoleSelect.value === 'superadmin';
          if (isSa) {
            editPagePerms.innerHTML = '<label>页面权限</label><p style="color:var(--text-secondary);font-size:13px;">超级管理员拥有全部页面权限</p>';
          } else {
            var currentPages = [];
            editPagePerms.querySelectorAll('.page-check:checked').forEach(function(cb) { currentPages.push(cb.value); });
            if (currentPages.length === 0) currentPages = userPages;
            editPagePerms.innerHTML = '<label>页面权限</label>' + buildPageCheckboxes(currentPages);
          }
        }
        editRoleSelect.addEventListener('change', toggleEditPagePerms);
        $('#saveEditUserBtn').addEventListener('click', function() {
          var isSa = editRoleSelect.value === 'superadmin';
          var passwordVal = $('#editPassword').value;
          var primaryGroup = $('#editCompanyGroup').value;
          var additionalGroups = [];
          $$('#editCompanyGroupsChecks .company-group-check:checked').forEach(function(cb) {
            if (cb.value !== primaryGroup) additionalGroups.push(cb.value);
          });
          var allGroups = primaryGroup !== 'general' ? [primaryGroup].concat(additionalGroups) : additionalGroups;
          var data = {
            username: $('#editUsername').value.trim(),
            display_name: $('#editDisplayName').value.trim(),
            company_group: primaryGroup,
            company_groups: allGroups,
            role: editRoleSelect.value,
            permissions: $('#editPerms').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
          };
          if (passwordVal && passwordVal.trim()) {
            data.password = passwordVal;
          }
          if (!isSa) {
            var pages = [];
            editPagePerms.querySelectorAll('.page-check:checked').forEach(function(cb) { pages.push(cb.value); });
            data.pages = pages;
          }
          if (!data.username) { toast('请填写用户名', 'error'); return; }
          apiFetch('/users/' + uid, { method: 'PUT', body: JSON.stringify(data) }).then(function() {
            toast('用户已更新', 'success');
            closeModal();
            renderRoute('users');
          }).catch(function(err) { toast('更新失败: ' + err.message, 'error'); });
        });
      });
    });
    $$('.delete-user-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var uid = parseInt(btn.dataset.userId);
        if (confirm('确定要删除该用户吗？')) {
          apiFetch('/users/' + uid, { method: 'DELETE' }).then(function() {
            toast('用户已删除', 'success');
            renderRoute('users');
          }).catch(function(err) { toast('删除失败: ' + err.message, 'error'); });
        }
      });
    });
    $$('.grant-user-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var uid = parseInt(btn.dataset.userId);
        var uname = btn.dataset.username;
        var bodyHtml =
          '<div class="form-group"><label>用户: ' + escHtml(uname) + '</label></div>' +
          '<div class="form-group"><label>权限 (逗号分隔: add,delete,view,modify)</label><input type="text" id="grantPerms" value="add,delete,modify" placeholder="add,delete,modify"></div>' +
          '<div class="form-group"><label>时长</label><select id="grantDuration">' +
            '<option value="1">1小时</option><option value="2">2小时</option><option value="4">4小时</option>' +
            '<option value="8">8小时</option><option value="12">12小时</option><option value="24">24小时</option>' +
            '<option value="48">48小时</option><option value="168">7天</option>' +
          '</select></div>' +
          '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" id="saveGrantBtn"><i class="fa-solid fa-check"></i> 授权</button></div>';
        showModal('授权用户', bodyHtml);
        $('#saveGrantBtn').addEventListener('click', function() {
          var data = {
            user_id: uid,
            permissions: $('#grantPerms').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
            duration_hours: parseFloat($('#grantDuration').value)
          };
          if (data.permissions.length === 0) { toast('请填写权限', 'error'); return; }
          apiFetch('/users/grant', { method: 'POST', body: JSON.stringify(data) }).then(function() {
            toast('授权成功', 'success');
            closeModal();
            renderRoute('users');
          }).catch(function(err) { toast('授权失败: ' + err.message, 'error'); });
        });
      });
    });
    $$('.revoke-grant-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.grantIdx);
        if (confirm('确定要收回该授权吗？')) {
          apiFetch('/users/grants/' + idx, { method: 'DELETE' }).then(function() {
            toast('授权已收回', 'success');
            renderRoute('users');
          }).catch(function(err) { toast('操作失败: ' + err.message, 'error'); });
        }
      });
    });
  }

  function renderSettings(content) {
    var groups = appState.data.envGroups || [];
    var mineGroups = appState.data.mineGroups || [];
    var canModify = hasPermission('modify');
    var groupsHtml = '';
    if (groups.length > 0) {
      groupsHtml = '<div class="env-groups-list" id="envGroupsList">' +
        groups.map(function(g, idx) {
          return '<div class="env-group-item" data-group-id="' + escHtml(g.id) + '" data-order="' + (g.order || idx) + '">' +
            '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
            '<input type="text" class="env-group-name-input" value="' + escHtml(g.name) + '" data-group-id="' + escHtml(g.id) + '"' + (canModify ? '' : ' disabled') + '>' +
            '<label class="env-group-visible"><input type="checkbox" class="env-group-visible-check" data-group-id="' + escHtml(g.id) + '"' + (g.visible !== false ? ' checked' : '') + (canModify ? '' : ' disabled') + '> 显示</label>' +
            (canModify ? '<button class="btn btn-sm btn-danger delete-group-btn" data-group-id="' + escHtml(g.id) + '"><i class="fa-solid fa-trash"></i></button>' : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    var mineGroupsHtml = '';
    if (mineGroups.length > 0) {
      mineGroupsHtml = '<div class="env-groups-list" id="mineGroupsList">' +
        mineGroups.map(function(g, idx) {
          return '<div class="env-group-item" data-group-id="' + escHtml(g.id) + '" data-order="' + (g.order || idx) + '">' +
            '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
            '<input type="text" class="env-group-name-input" value="' + escHtml(g.name) + '" data-group-id="' + escHtml(g.id) + '"' + (canModify ? '' : ' disabled') + '>' +
            '<label class="env-group-visible"><input type="checkbox" class="mine-group-visible-check" data-group-id="' + escHtml(g.id) + '"' + (g.visible !== false ? ' checked' : '') + (canModify ? '' : ' disabled') + '> 显示</label>' +
            (canModify ? '<button class="btn btn-sm btn-danger delete-mine-group-btn" data-group-id="' + escHtml(g.id) + '"><i class="fa-solid fa-trash"></i></button>' : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    content.innerHTML = '<h2 class="page-title">⚙️ 系统设置</h2>' +
      '<div class="settings-section">' +
        '<h3>主题管理</h3>' +
        '<div class="settings-row">' +
          '<div><div class="settings-label">主题模式</div><div class="settings-desc">切换浅色/深色主题</div></div>' +
          '<div class="theme-options">' +
            '<button class="theme-option' + (appState.theme === 'light' ? ' active' : '') + '" data-theme="light">☀️ 浅色</button>' +
            '<button class="theme-option' + (appState.theme === 'dark' ? ' active' : '') + '" data-theme="dark">🌙 深色</button>' +
          '</div>' +
        '</div>' +
        '<div class="settings-row">' +
          '<div><div class="settings-label">主色调</div><div class="settings-desc">自定义主题颜色</div></div>' +
          '<div class="color-picker-row"><input type="color" id="primaryColorPicker" value="' + appState.primaryColor + '"><span style="font-size:13px;">' + appState.primaryColor + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>通用设置</h3>' +
        '<div class="settings-row">' +
          '<div><div class="settings-label">软件管家默认显示模式</div><div class="settings-desc">网格或列表视图</div></div>' +
          '<div class="theme-options">' +
            '<button class="theme-option' + (appState.toolView === 'grid' ? ' active' : '') + '" data-view="grid"><i class="fa-solid fa-grid-2"></i> 网格</button>' +
            '<button class="theme-option' + (appState.toolView === 'list' ? ' active' : '') + '" data-view="list"><i class="fa-solid fa-list"></i> 列表</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>网址大全分组配置</h3>' +
        '<div class="settings-desc" style="margin-bottom:12px;">拖拽调整顺序，修改名称，勾选显示/隐藏</div>' +
        groupsHtml +
        (canModify ? '<div style="margin-top:12px;"><button class="btn btn-primary" id="addGroupBtn"><i class="fa-solid fa-plus"></i> 添加分组</button> <button class="btn btn-primary" id="saveGroupsBtn"><i class="fa-solid fa-check"></i> 保存分组</button></div>' : '') +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>工具箱分组配置</h3>' +
        '<div class="settings-desc" style="margin-bottom:12px;">拖拽调整顺序，修改名称，勾选显示/隐藏</div>' +
        '<div class="env-groups-list" id="toolboxGroupsList">' +
        (appState.data.toolboxGroups || []).map(function(g, idx) {
          return '<div class="env-group-item" data-group-id="' + escHtml(g.id) + '" data-order="' + (g.order || idx) + '">' +
            '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
            '<input type="text" class="env-group-name-input" value="' + escHtml(g.name) + '" data-group-id="' + escHtml(g.id) + '"' + (canModify ? '' : ' disabled') + '>' +
            '<label class="env-group-visible"><input type="checkbox" class="env-group-visible-check" data-group-id="' + escHtml(g.id) + '"' + (g.visible !== false ? ' checked' : '') + (canModify ? '' : ' disabled') + '> 显示</label>' +
            (canModify ? '<button class="btn btn-sm btn-danger delete-tb-group-btn" data-group-id="' + escHtml(g.id) + '"><i class="fa-solid fa-trash"></i></button>' : '') +
          '</div>';
        }).join('') +
        '</div>' +
        (canModify ? '<div style="margin-top:12px;"><button class="btn btn-primary" id="addTbGroupBtn"><i class="fa-solid fa-plus"></i> 添加分组</button> <button class="btn btn-primary" id="saveTbGroupsBtn"><i class="fa-solid fa-check"></i> 保存分组</button></div>' : '') +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>矿区分组配置</h3>' +
        '<div class="settings-desc" style="margin-bottom:12px;">管理矿区，添加、删除或修改矿区名称，环境将按矿区分组显示</div>' +
        mineGroupsHtml +
        (canModify ? '<div style="margin-top:12px;"><button class="btn btn-primary" id="addMineGroupBtn"><i class="fa-solid fa-plus"></i> 添加矿区</button> <button class="btn btn-primary" id="saveMineGroupsBtn"><i class="fa-solid fa-check"></i> 保存矿区</button></div>' : '') +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>菜单栏顺序配置</h3>' +
        '<div class="settings-desc" style="margin-bottom:12px;">拖拽调整菜单项的显示顺序</div>' +
        '<div class="env-groups-list" id="menuOrderList">' +
        (appState.data.menuOrder || DEFAULT_MENU_ORDER).map(function(route, idx) {
          if (!PAGE_CONFIG[route]) return '';
          return '<div class="env-group-item menu-order-item" data-route="' + route + '" data-order="' + idx + '">' +
            '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
            '<i class="fa-solid ' + PAGE_CONFIG[route].icon + '" style="color:var(--primary-color);width:20px;text-align:center;"></i>' +
            '<input type="text" class="env-group-name-input" value="' + escHtml(PAGE_CONFIG[route].name) + '" disabled style="flex:1;">' +
          '</div>';
        }).join('') +
        '</div>' +
        (canModify ? '<div style="margin-top:12px;"><button class="btn btn-primary" id="saveMenuOrderBtn"><i class="fa-solid fa-check"></i> 保存菜单顺序</button></div>' : '') +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>关于</h3>' +
        '<div class="about-info">' +
          '<div class="about-row"><span class="about-label">前端版本</span><span class="about-value">v1.0.0</span></div>' +
          '<div class="about-row"><span class="about-label">后端版本</span><span class="about-value">v1.0.0</span></div>' +
          '<div class="about-row"><span class="about-label">API状态</span><span class="about-value"><span id="apiStatus" class="connection-dot disconnected"></span><span id="apiStatusText">检测中...</span></span></div>' +
          '<div class="about-row"><span class="about-label">WebSocket</span><span class="about-value"><span id="wsStatus" class="connection-dot disconnected"></span><span id="wsStatusText">未连接</span></span></div>' +
        '</div>' +
      '</div>';

    bindSettingsEvents();
    bindEnvGroupSettingsEvents();
    bindToolboxGroupSettingsEvents();
    bindMineGroupSettingsEvents();
    bindMenuOrderSettingsEvents();
    checkApiStatus();
  }

  function bindSettingsEvents() {
    $$('.theme-option[data-theme]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setTheme(btn.dataset.theme);
        $$('.theme-option[data-theme]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
    var colorPicker = $('#primaryColorPicker');
    if (colorPicker) {
      colorPicker.addEventListener('input', function() {
        setPrimaryColor(this.value);
      });
    }
    $$('.theme-option[data-view]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        appState.toolView = btn.dataset.view;
        saveLocalSetting('toolView', appState.toolView);
        $$('.theme-option[data-view]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }

  function bindEnvGroupSettingsEvents() {
    var list = $('#envGroupsList');
    if (!list) return;
    var dragged = null;
    $$('.env-group-item').forEach(function(item) {
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', function(e) {
        dragged = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        dragged = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (item !== dragged) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragged && dragged !== item) {
          var items = Array.from(list.children);
          var fromIdx = items.indexOf(dragged);
          var toIdx = items.indexOf(item);
          if (fromIdx < toIdx) {
            list.insertBefore(dragged, item.nextSibling);
          } else {
            list.insertBefore(dragged, item);
          }
        }
      });
    });

    var addBtn = $('#addGroupBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var newId = 'group_' + Date.now();
        var div = document.createElement('div');
        div.className = 'env-group-item';
        div.setAttribute('draggable', 'true');
        div.dataset.groupId = newId;
        div.dataset.order = list.children.length;
        div.innerHTML = '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
          '<input type="text" class="env-group-name-input" value="新分组" data-group-id="' + newId + '">' +
          '<label class="env-group-visible"><input type="checkbox" class="env-group-visible-check" data-group-id="' + newId + '" checked> 显示</label>' +
          '<button class="btn btn-sm btn-danger delete-group-btn" data-group-id="' + newId + '"><i class="fa-solid fa-trash"></i></button>';
        list.appendChild(div);
        bindEnvGroupSettingsEvents();
      });
    }

    $$('.delete-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var gid = btn.dataset.groupId;
        var item = $('.env-group-item[data-group-id="' + gid + '"]');
        if (item) item.remove();
      });
    });

    var saveBtn = $('#saveGroupsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var items = Array.from($$('#envGroupsList .env-group-item'));
        var newGroups = items.map(function(item, idx) {
          var gid = item.dataset.groupId;
          var nameInput = $('.env-group-name-input[data-group-id="' + gid + '"]');
          var visibleCheck = $('.env-group-visible-check[data-group-id="' + gid + '"]');
          return { id: gid, name: nameInput ? nameInput.value.trim() : gid, order: idx, visible: visibleCheck ? visibleCheck.checked : true };
        });
        apiFetch('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ envGroups: newGroups })
        }).then(function() {
          appState.data.envGroups = newGroups;
          toast('分组配置已保存', 'success');
          renderRoute('settings');
        }).catch(function(err) {
          toast('保存失败: ' + err.message, 'error');
        });
      });
    }
  }

  function bindToolboxGroupSettingsEvents() {
    var list = $('#toolboxGroupsList');
    if (!list) return;
    var dragged = null;
    $$('#toolboxGroupsList .env-group-item').forEach(function(item) {
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', function(e) {
        dragged = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        dragged = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (item !== dragged) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragged && dragged !== item) {
          var items = Array.from(list.children);
          var fromIdx = items.indexOf(dragged);
          var toIdx = items.indexOf(item);
          if (fromIdx < toIdx) {
            list.insertBefore(dragged, item.nextSibling);
          } else {
            list.insertBefore(dragged, item);
          }
        }
      });
    });

    var addBtn = $('#addTbGroupBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var newId = 'tb_group_' + Date.now();
        var div = document.createElement('div');
        div.className = 'env-group-item';
        div.setAttribute('draggable', 'true');
        div.dataset.groupId = newId;
        div.dataset.order = list.children.length;
        div.innerHTML = '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
          '<input type="text" class="env-group-name-input" value="新分组" data-group-id="' + newId + '">' +
          '<label class="env-group-visible"><input type="checkbox" class="env-group-visible-check" data-group-id="' + newId + '" checked> 显示</label>' +
          '<button class="btn btn-sm btn-danger delete-tb-group-btn" data-group-id="' + newId + '"><i class="fa-solid fa-trash"></i></button>';
        list.appendChild(div);
        bindToolboxGroupSettingsEvents();
      });
    }

    $$('.delete-tb-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var gid = btn.dataset.groupId;
        var item = $('#toolboxGroupsList .env-group-item[data-group-id="' + gid + '"]');
        if (item) item.remove();
      });
    });

    var saveBtn = $('#saveTbGroupsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var items = Array.from($$('#toolboxGroupsList .env-group-item'));
        var newGroups = items.map(function(item, idx) {
          var gid = item.dataset.groupId;
          var nameInput = $('.env-group-name-input[data-group-id="' + gid + '"]');
          var visibleCheck = $('.env-group-visible-check[data-group-id="' + gid + '"]');
          return { id: gid, name: nameInput ? nameInput.value.trim() : gid, order: idx, visible: visibleCheck ? visibleCheck.checked : true };
        });
        apiFetch('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolboxGroups: newGroups })
        }).then(function() {
          appState.data.toolboxGroups = newGroups;
          toast('工具箱分组配置已保存', 'success');
          renderRoute('settings');
        }).catch(function(err) {
          toast('保存失败: ' + err.message, 'error');
        });
      });
    }
  }

  function bindMineGroupSettingsEvents() {
    var list = $('#mineGroupsList');
    if (!list) return;
    var dragged = null;
    $$('#mineGroupsList .env-group-item').forEach(function(item) {
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', function(e) {
        dragged = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        dragged = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (item !== dragged) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragged && dragged !== item) {
          var items = Array.from(list.children);
          var fromIdx = items.indexOf(dragged);
          var toIdx = items.indexOf(item);
          if (fromIdx < toIdx) {
            list.insertBefore(dragged, item.nextSibling);
          } else {
            list.insertBefore(dragged, item);
          }
        }
      });
    });

    var addBtn = $('#addMineGroupBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var newId = 'mine_' + Date.now();
        var div = document.createElement('div');
        div.className = 'env-group-item';
        div.setAttribute('draggable', 'true');
        div.dataset.groupId = newId;
        div.dataset.order = list.children.length;
        div.innerHTML = '<span class="env-group-drag"><i class="fa-solid fa-grip-vertical"></i></span>' +
          '<input type="text" class="env-group-name-input" value="新矿区" data-group-id="' + newId + '">' +
          '<label class="env-group-visible"><input type="checkbox" class="mine-group-visible-check" data-group-id="' + newId + '" checked> 显示</label>' +
          '<button class="btn btn-sm btn-danger delete-mine-group-btn" data-group-id="' + newId + '"><i class="fa-solid fa-trash"></i></button>';
        list.appendChild(div);
        bindMineGroupSettingsEvents();
      });
    }

    $$('#mineGroupsList .delete-mine-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var gid = btn.dataset.groupId;
        var item = $('#mineGroupsList .env-group-item[data-group-id="' + gid + '"]');
        if (item) item.remove();
      });
    });

    var saveBtn = $('#saveMineGroupsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var items = Array.from($$('#mineGroupsList .env-group-item'));
        var newGroups = items.map(function(item, idx) {
          var gid = item.dataset.groupId;
          var nameInput = $('.env-group-name-input[data-group-id="' + gid + '"]');
          var visibleCheck = $('.mine-group-visible-check[data-group-id="' + gid + '"]');
          return { id: gid, name: nameInput ? nameInput.value.trim() : gid, order: idx, visible: visibleCheck ? visibleCheck.checked : true };
        });
        apiFetch('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mineGroups: newGroups })
        }).then(function() {
          appState.data.mineGroups = newGroups;
          toast('矿区分组配置已保存', 'success');
          renderRoute('settings');
        }).catch(function(err) {
          toast('保存失败: ' + err.message, 'error');
        });
      });
    }
  }

  function bindMenuOrderSettingsEvents() {
    var list = $('#menuOrderList');
    if (!list) return;
    var dragged = null;
    $$('#menuOrderList .menu-order-item').forEach(function(item) {
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', function(e) {
        dragged = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        dragged = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (item !== dragged) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragged && dragged !== item) {
          var items = Array.from(list.children);
          var fromIdx = items.indexOf(dragged);
          var toIdx = items.indexOf(item);
          if (fromIdx < toIdx) {
            list.insertBefore(dragged, item.nextSibling);
          } else {
            list.insertBefore(dragged, item);
          }
        }
      });
    });

    var saveBtn = $('#saveMenuOrderBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var items = Array.from($$('#menuOrderList .menu-order-item'));
        var newOrder = items.map(function(item) { return item.dataset.route; });
        apiFetch('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menuOrder: newOrder })
        }).then(function() {
          appState.data.menuOrder = newOrder;
          toast('菜单顺序已保存', 'success');
          renderSidebar();
          renderRoute('settings');
        }).catch(function(err) {
          toast('保存失败: ' + err.message, 'error');
        });
      });
    }
  }

  function checkApiStatus() {
    fetch(API_BASE).then(function(res) {
      if (res.ok) {
        var el = $('#apiStatus');
        var txt = $('#apiStatusText');
        if (el) { el.className = 'connection-dot connected'; }
        if (txt) { txt.textContent = '已连接'; }
      }
    }).catch(function() {
      var el = $('#apiStatus');
      var txt = $('#apiStatusText');
      if (el) { el.className = 'connection-dot disconnected'; }
      if (txt) { txt.textContent = '连接失败'; }
    });
    updateConnectionIndicator();
    setInterval(function() {
      var wsEl = $('#wsStatus');
      var wsTxt = $('#wsStatusText');
      if (wsEl) { wsEl.className = 'connection-dot ' + (appState.wsConnected ? 'connected' : 'disconnected'); }
      if (wsTxt) { wsTxt.textContent = appState.wsConnected ? '已连接' : '未连接'; }
    }, 2000);
  }

  function showToolDetail(tool) {
    var isFav = appState.data.favorites.tools.indexOf(tool.id) !== -1;
    var canModify = hasPermission('modify');
    var iconHtml = tool.icon && (tool.icon.startsWith('/icons/') || tool.icon.startsWith('http')) 
      ? '<img src="' + escHtml(tool.icon) + '" style="width:64px;height:64px;object-fit:contain;">' 
      : '<i class="' + escHtml(tool.icon || 'fa-solid fa-gear') + '"></i>';
    var groups = appState.data.toolCompanyGroups || [];
    var groupInfo = groups.find(function(g) { return g.id === (tool.company_group || 'general'); });
    var groupName = groupInfo ? groupInfo.name : '通用软件';
    var tagsHtml = (tool.tags || []).length > 0 ? '<div class="detail-field"><div class="detail-field-label">标签</div><div class="detail-field-value">' + 
      (tool.tags || []).map(function(tag) { return '<span style="background:var(--primary-light);color:var(--primary-color);padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;"><i class="fa-solid fa-tag"></i> ' + escHtml(tag) + '</span>'; }).join('') + '</div></div>' : '';
    var actionBtns = '';
    if (tool.link && tool.link.trim()) {
      actionBtns += '<a href="' + escHtml(tool.link) + '" target="_blank" class="btn btn-primary" style="margin:0 4px;text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> 访问官网</a>';
    }
    if (tool.package_name && tool.package_name.trim()) {
      var sizeStr = tool.package_size ? ' (' + (tool.package_size / 1024 / 1024).toFixed(2) + ' MB)' : '';
      actionBtns += '<button class="btn btn-success download-modal-btn" data-tool-id="' + tool.id + '" style="margin:0 4px;"><i class="fa-solid fa-download"></i> 下载安装包' + sizeStr + '</button>';
    }
    var bodyHtml = '<div class="tool-detail-icon">' + iconHtml + '</div>' +
      '<div class="tool-detail-name">' + escHtml(tool.name) + '</div>' +
      '<div class="tool-detail-category">' + escHtml(tool.category) + ' · ' + escHtml(tool.os === 'windows' ? 'Windows' : 'Ubuntu') + ' · <i class="fa-solid fa-users"></i> ' + escHtml(groupName) + '</div>' +
      '<div class="tool-detail-desc">' + escHtml(tool.description) + '</div>' +
      tagsHtml +
      (canModify && tool.command ? '<div class="detail-field"><div class="detail-field-label">安装/启动命令</div><div class="detail-field-value">' + escHtml(tool.command) + ' <button class="btn btn-sm copy-cmd-modal-btn" style="float:right;"><i class="fa-solid fa-copy"></i></button></div></div>' : '') +
      '<div style="margin-top:20px;text-align:center;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;">' +
        actionBtns +
        '<button class="btn btn-primary fav-toggle-btn" data-fav-type="tool" data-fav-id="' + tool.id + '"><i class="fa-solid fa-star"></i> ' + (isFav ? '取消收藏' : '添加收藏') + '</button>' +
      '</div>';

    showModal(tool.name, bodyHtml);
    addHistory('tool', tool.id);

    var favBtn = $('.fav-toggle-btn');
    if (favBtn) {
      favBtn.addEventListener('click', function() {
        toggleFavorite(favBtn.dataset.favType, parseInt(favBtn.dataset.favId), favBtn);
      });
    }
    var copyBtn = $('.copy-cmd-modal-btn');
    if (copyBtn && tool.command) {
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(tool.command).then(function() {
          toast('命令已复制', 'success');
        }).catch(function() {
          toast('复制失败', 'error');
        });
      });
    }
    var downloadBtn = $('.download-modal-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async function() {
        var toolId = parseInt(downloadBtn.dataset.toolId);
        try {
          var res = await fetch(API_BASE + '/tools/' + toolId + '/download', {
            headers: { 'Authorization': 'Bearer ' + appState.authToken }
          });
          if (!res.ok) throw new Error('Download failed');
          var blob = await res.blob();
          var disposition = res.headers.get('Content-Disposition');
          var filename = tool.name;
          if (disposition) {
            var utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            if (utf8Match) {
              filename = decodeURIComponent(utf8Match[1]);
            } else {
              var asciiMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (asciiMatch) filename = asciiMatch[1].replace(/['"]/g, '');
            }
          }
          var url = window.URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast('开始下载: ' + tool.name, 'success');
        } catch(e) {
          toast('下载失败: ' + e.message, 'error');
        }
      });
    }
  }

  function showModal(title, bodyHtml) {
    var overlay = $('#modalOverlay');
    var box = $('#modalBox');
    box.innerHTML = '<div class="modal-header"><h3>' + title + '</h3><button class="modal-close" id="modalClose"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="modal-body">' + bodyHtml + '</div>';
    overlay.classList.remove('hidden');

    $('#modalClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
    });
  }

  function closeModal() {
    $('#modalOverlay').classList.add('hidden');
  }

  function toggleFavorite(type, id, btnEl) {
    var favId = String(id);
    apiFetch('/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, id: favId })
    }).then(function(result) {
      appState.data.favorites = result.favorites;
      if (btnEl) {
        btnEl.classList.toggle('active', result.action === 'added');
      }
      toast(result.action === 'added' ? '已添加到收藏' : '已取消收藏', 'success');
      var currentPage = $('#content').dataset.page;
      if (currentPage === 'favorites' || currentPage === 'home' || currentPage === 'toolbox' || currentPage === 'tools' || currentPage === 'urls' || currentPage === 'envs') {
        renderRoute(currentPage);
      }
    }).catch(function(err) {
      var msg = (err && err.message) ? String(err.message) : '请稍后重试';
      try {
        var parsed = JSON.parse(msg);
        if (Array.isArray(parsed)) {
          msg = parsed.map(function(e) { return e.msg || e.message || String(e); }).join('; ');
        } else if (parsed.detail) {
          msg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch(e) {}
      toast('操作失败：' + msg, 'error');
      console.error('toggleFavorite error:', err);
    });
  }

  function addHistory(type, id) {
    apiFetch('/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, id: id })
    }).catch(function() {});
  }

  function renderApiManagement(content) {
    var isAdmin = appState.currentUser && appState.currentUser.role === 'superadmin';
    content.innerHTML = '<h2 class="page-title">📡 REST API 管理</h2>' +
      '<div id="apiStatusCard" class="api-status-card">' +
        '<div class="api-status-header">' +
          '<h3>API 服务状态</h3>' +
          '<span id="apiRunningBadge" class="api-status-badge loading">检测中...</span>' +
        '</div>' +
        '<div class="api-status-content">' +
          '<div class="api-status-indicator">' +
            '<div id="apiStatusDot" class="api-dot loading"></div>' +
            '<div class="api-status-text">' +
              '<div id="apiStatusMsg" class="api-status-msg">正在检测服务状态...</div>' +
              '<div id="apiPortDisplay" class="api-port-display"></div>' +
            '</div>' +
          '</div>' +
          '<div class="api-base-url-box">' +
            '<div class="api-base-url-label">API 基础地址</div>' +
            '<div id="apiBaseUrl" class="api-base-url">-</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (isAdmin ? '<div class="api-config-card">' +
        '<h3><i class="fa-solid fa-gear"></i> API 配置</h3>' +
        '<div class="api-config-form">' +
          '<div class="form-group api-form-group">' +
            '<label>API 端口</label>' +
            '<input type="number" id="apiPortInput" min="1" max="65535" value="3143">' +
          '</div>' +
          '<div class="form-group api-form-group">' +
            '<label>认证 Token</label>' +
            '<div class="token-input-wrapper">' +
              '<input type="text" id="apiTokenInput" placeholder="API Token" readonly>' +
              '<button type="button" class="btn btn-sm" id="copyTokenBtn" title="复制Token"><i class="fa-solid fa-copy"></i></button>' +
              '<button type="button" class="btn btn-sm" id="generateTokenBtn" title="重新生成Token"><i class="fa-solid fa-rotate"></i></button>' +
            '</div>' +
          '</div>' +
          '<div class="api-checkbox-row">' +
            '<label class="api-checkbox-label">' +
              '<input type="checkbox" id="apiEnabledCheck" checked>' +
              '<span>启用 API 服务</span>' +
            '</label>' +
            '<label class="api-checkbox-label">' +
              '<input type="checkbox" id="tokenAuthCheck" checked>' +
              '<span>需要 Token 认证</span>' +
            '</label>' +
          '</div>' +
          '<div class="api-actions">' +
            '<button class="btn btn-success" id="saveApiConfigBtn"><i class="fa-solid fa-save"></i> 保存设置</button>' +
            '<button class="btn btn-primary" id="testConnectionBtn"><i class="fa-solid fa-magnifying-glass"></i> 测试连接</button>' +
            '<button class="btn btn-primary" id="viewSwaggerBtn"><i class="fa-solid fa-book"></i> 查看 Swagger 文档</button>' +
            '<button class="btn btn-primary" id="viewRedocBtn"><i class="fa-solid fa-file-lines"></i> 查看 ReDoc 文档</button>' +
          '</div>' +
        '</div>' +
      '</div>' : '<div class="api-config-card">' +
        '<h3><i class="fa-solid fa-book"></i> API 文档</h3>' +
        '<p style="color:var(--text-secondary);margin-bottom:16px;">API服务已开启，您可以通过以下链接查看API文档，用于第三方系统集成调用。</p>' +
        '<div class="api-actions">' +
          '<button class="btn btn-primary" id="viewSwaggerBtn"><i class="fa-solid fa-book"></i> 查看 Swagger 文档</button>' +
          '<button class="btn btn-primary" id="viewRedocBtn"><i class="fa-solid fa-file-lines"></i> 查看 ReDoc 文档</button>' +
        '</div>' +
      '</div>') +
      '<div id="apiDocsModal" class="api-docs-modal" style="display:none;">' +
        '<div class="api-docs-modal-content">' +
          '<div class="api-docs-header">' +
            '<h3 id="apiDocsTitle">API 文档</h3>' +
            '<div class="api-docs-tabs">' +
              '<button class="api-doc-tab active" data-doc="swagger">Swagger UI</button>' +
              '<button class="api-doc-tab" data-doc="redoc">ReDoc</button>' +
              '<button class="api-doc-close" id="closeApiDocs"><i class="fa-solid fa-xmark"></i> 关闭</button>' +
            '</div>' +
          '</div>' +
          '<div id="apiDocsContainer" style="position:relative;flex:1;min-height:0;">' +
            '<div id="apiDocsLoading" style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;background:white;"><div style="width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#667eea;border-radius:50%;animation:apiSpin 0.8s linear infinite;margin-right:12px;"></div>正在加载 API 文档...</div>' +
            '<iframe id="apiDocsIframe" style="width:100%;height:100%;border:none;position:absolute;top:0;left:0;"></iframe>' +
          '</div>' +
        '</div>' +
      '</div>';

    loadApiConfig();
    bindApiManagementEvents();
  }

  function loadApiConfig() {
    apiFetch('/api-config').then(function(config) {
      var isAdmin = config.is_admin || (appState.currentUser && appState.currentUser.role === 'superadmin');
      if (isAdmin) {
        var portInput = $('#apiPortInput');
        var tokenInput = $('#apiTokenInput');
        var enabledCheck = $('#apiEnabledCheck');
        var tokenCheck = $('#tokenAuthCheck');
        if (portInput) portInput.value = config.port || 3143;
        if (tokenInput) tokenInput.value = config.api_token || '';
        if (enabledCheck) enabledCheck.checked = config.enabled !== false;
        if (tokenCheck) tokenCheck.checked = config.token_auth_enabled !== false;
      }
      var baseUrlEl = $('#apiBaseUrl');
      var portDisplay = $('#apiPortDisplay');
      if (baseUrlEl) baseUrlEl.textContent = config.base_url || '-';
      if (portDisplay) portDisplay.textContent = '端口: ' + (config.port || 3143);

      var dot = $('#apiStatusDot');
      var badge = $('#apiRunningBadge');
      var msg = $('#apiStatusMsg');
      if (config.running) {
        if (dot) dot.className = 'api-dot running';
        if (badge) { badge.className = 'api-status-badge running'; badge.textContent = '● 运行中'; }
        if (msg) msg.textContent = 'API 服务运行正常';
      } else {
        if (dot) dot.className = 'api-dot stopped';
        if (badge) { badge.className = 'api-status-badge stopped'; badge.textContent = '○ 已停止'; }
        if (msg) msg.textContent = 'API 服务未运行';
      }
    }).catch(function(err) {
      toast('加载API配置失败: ' + err.message, 'error');
      var dot = $('#apiStatusDot');
      var badge = $('#apiRunningBadge');
      var msg = $('#apiStatusMsg');
      if (dot) dot.className = 'api-dot stopped';
      if (badge) { badge.className = 'api-status-badge stopped'; badge.textContent = '○ 检测失败'; }
      if (msg) msg.textContent = '无法获取服务状态';
    });
  }

  function bindApiManagementEvents() {
    var saveBtn = $('#saveApiConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var port = parseInt($('#apiPortInput').value);
        if (!port || port < 1 || port > 65535) {
          toast('请输入有效的端口号 (1-65535)', 'error');
          return;
        }
        var payload = {
          enabled: $('#apiEnabledCheck').checked,
          port: port,
          token_auth_enabled: $('#tokenAuthCheck').checked,
          api_token: $('#apiTokenInput').value.trim()
        };
        apiFetch('/api-config', {
          method: 'PUT',
          body: JSON.stringify(payload)
        }).then(function() {
          toast('API配置已保存，服务重启后生效', 'success');
          loadApiConfig();
        }).catch(function(err) {
          toast('保存失败: ' + err.message, 'error');
        });
      });
    }

    var genTokenBtn = $('#generateTokenBtn');
    if (genTokenBtn) {
      genTokenBtn.addEventListener('click', function() {
        if (confirm('确定要重新生成API Token吗？旧Token将立即失效！')) {
          apiFetch('/api-config/generate-token', { method: 'POST' }).then(function(result) {
            $('#apiTokenInput').value = result.api_token;
            toast('新Token已生成', 'success');
          }).catch(function(err) {
            toast('生成Token失败: ' + err.message, 'error');
          });
        }
      });
    }

    var copyBtn = $('#copyTokenBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var token = $('#apiTokenInput').value;
        if (token) {
          navigator.clipboard.writeText(token).then(function() {
            toast('Token已复制到剪贴板', 'success');
          }).catch(function() {
            toast('复制失败', 'error');
          });
        }
      });
    }

    var testBtn = $('#testConnectionBtn');
    if (testBtn) {
      testBtn.addEventListener('click', function() {
        var btn = testBtn;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 测试中...';
        apiFetch('/api-config/test-connection', { method: 'POST' }).then(function(result) {
          if (result.connected) {
            toast('连接成功！API服务正常运行', 'success');
          } else if (result.running) {
            toast('端口已开放但认证可能失败: ' + (result.error || '未知错误'), 'warning');
          } else {
            toast('连接失败: ' + (result.error || '服务未运行'), 'error');
          }
          loadApiConfig();
        }).catch(function(err) {
          toast('测试失败: ' + err.message, 'error');
        }).finally(function() {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 测试连接';
        });
      });
    }

    var swaggerBtn = $('#viewSwaggerBtn');
    if (swaggerBtn) swaggerBtn.addEventListener('click', function() { showApiDocsModal('swagger'); });

    var redocBtn = $('#viewRedocBtn');
    if (redocBtn) redocBtn.addEventListener('click', function() { showApiDocsModal('redoc'); });

    $$('.api-doc-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        $$('.api-doc-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        switchApiDocsView(tab.dataset.doc);
      });
    });

    var closeBtn = $('#closeApiDocs');
    if (closeBtn) closeBtn.addEventListener('click', closeApiDocsModal);

    var modal = $('#apiDocsModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === this) closeApiDocsModal();
      });
    }
  }

  var apiDocsCurrentView = null;

  function getApiOpenApiUrl() {
    var portInput = $('#apiPortInput');
    var port = portInput ? parseInt(portInput.value) || 3143 : 3143;
    var currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    if (String(port) === String(currentPort)) {
      return '/openapi.json';
    }
    return window.location.protocol + '//' + window.location.hostname + ':' + port + '/openapi.json';
  }

  function generateSwaggerIframeHtml(openApiUrl) {
    var safeUrl = openApiUrl.replace(/"/g, '');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>Swagger UI</title>' +
      '<link rel="stylesheet" href="/static/swagger-ui.css">' +
      '<style>html,body{margin:0;padding:0;background:#fafafa;height:100%;} #swagger-ui{margin-top:0;}</style>' +
      '</head><body>' +
      '<div id="swagger-ui"></div>' +
      '<script src="/static/swagger-ui-bundle.js"><\/script>' +
      '<script src="/static/swagger-ui-standalone-preset.js"><\/script>' +
      '<script>' +
      'window.onload = function() {' +
      '  SwaggerUIBundle({' +
      '    url: "' + safeUrl + '",' +
      '    dom_id: "#swagger-ui",' +
      '    deepLinking: true,' +
      '    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset.slice(1)],' +
      '    layout: "BaseLayout",' +
      '    withCredentials: true,' +
      '    filter: true' +
      '  });' +
      '};<\/script>' +
      '</body></html>';
  }

  function generateRedocIframeHtml(openApiUrl) {
    var safeUrl = openApiUrl.replace(/"/g, '');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>ReDoc</title>' +
      '<style>html,body{margin:0;padding:0;background:white;height:100%;overflow:hidden;} redoc{display:block;height:100vh;overflow:auto;}</style>' +
      '</head><body>' +
      '<redoc spec-url="' + safeUrl + '" expand-responses="all" required-props-first="true" scroll-y-offset="80" disable-search></redoc>' +
      '<script src="/static/redoc.standalone.js"><\/script>' +
      '</body></html>';
  }

  function showApiDocsModal(viewType) {
    var modal = $('#apiDocsModal');
    modal.style.display = 'flex';
    $('#apiDocsLoading').style.display = 'flex';
    $$('.api-doc-tab').forEach(function(t) { t.classList.remove('active'); });
    var targetTab = document.querySelector('.api-doc-tab[data-doc="' + (viewType || 'swagger') + '"]');
    if (targetTab) targetTab.classList.add('active');
    apiDocsCurrentView = null;
    switchApiDocsView(viewType || 'swagger');
  }

  function switchApiDocsView(viewType) {
    if (viewType === apiDocsCurrentView) return;
    apiDocsCurrentView = viewType;
    $('#apiDocsLoading').style.display = 'flex';
    var title = viewType === 'swagger' ? '📖 Swagger UI - API 文档' : '📄 ReDoc - API 文档';
    $('#apiDocsTitle').textContent = title;

    var iframe = $('#apiDocsIframe');
    var loadingHidden = false;
    function hideLoading() {
      if (loadingHidden) return;
      loadingHidden = true;
      var el = $('#apiDocsLoading');
      if (el) el.style.display = 'none';
    }
    iframe.onload = function() {
      setTimeout(hideLoading, 200);
    };
    var portInput = $('#apiPortInput');
    var port = portInput ? parseInt(portInput.value) || 3143 : 3143;
    var currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    var baseUrl = String(port) === String(currentPort) ? '' : (window.location.protocol + '//' + window.location.hostname + ':' + port);
    iframe.src = baseUrl + (viewType === 'swagger' ? '/docs' : '/redoc');
    setTimeout(hideLoading, 6000);
  }

  function closeApiDocsModal() {
    $('#apiDocsModal').style.display = 'none';
    apiDocsCurrentView = null;
    var iframe = $('#apiDocsIframe');
    if (iframe) { iframe.onload = null; iframe.src = 'about:blank'; }
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getUserDisplayName(user) {
    if (!user) return '用户';
    return user.display_name && user.display_name.trim() ? user.display_name : user.username;
  }

  function buildEnvUrl(env) {
    var proto = env.protocol || 'http';
    var accessType = env.accessType || 'ip';
    var host = accessType === 'domain' ? env.domain : env.ip;
    if (!host) return '';
    var url = proto + '://' + host;
    if (accessType === 'ip') {
      if (env.port && !(proto === 'http' && env.port === 80) && !(proto === 'https' && env.port === 443)) {
        url += ':' + env.port;
      }
    }
    if (env.path) {
      url += env.path;
    }
    return url;
  }

  function initGlobalSearch() {
    var input = $('#globalSearch');
    var results = $('#searchResults');
    var debounceTimer;

    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      if (q.length < 1) {
        results.classList.add('hidden');
        return;
      }
      debounceTimer = setTimeout(function() {
        apiFetch('/search?q=' + encodeURIComponent(q)).then(function(data) {
          if (data.envs.length === 0 && data.tools.length === 0) {
            results.innerHTML = '<div class="search-empty">未找到匹配结果</div>';
          } else {
            results.innerHTML = data.envs.map(function(e) {
              var host = (e.accessType === 'domain' && e.domain) ? e.domain : e.ip;
              return '<div class="search-result-item" data-type="env" data-id="' + e.id + '">' +
                '<span class="sr-icon"><i class="fa-solid fa-server"></i></span>' +
                '<div class="sr-info"><div class="sr-name">' + escHtml(e.name) + '</div><div class="sr-desc">' + escHtml(host) + '</div></div>' +
              '</div>';
            }).join('') + data.tools.map(function(t) {
              return '<div class="search-result-item" data-type="tool" data-id="' + t.id + '">' +
                '<span class="sr-icon"><i class="' + escHtml(t.icon) + '"></i></span>' +
                '<div class="sr-info"><div class="sr-name">' + escHtml(t.name) + '</div><div class="sr-desc">' + escHtml(t.description) + '</div></div>' +
              '</div>';
            }).join('');
          }
          results.classList.remove('hidden');
        }).catch(function() {
          results.innerHTML = '<div class="search-empty">搜索失败</div>';
          results.classList.remove('hidden');
        });
      }, 300);
    });

    input.addEventListener('focus', function() {
      if (input.value.trim().length >= 1) results.classList.remove('hidden');
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.topbar-search')) {
        results.classList.add('hidden');
      }
    });

    results.addEventListener('click', function(e) {
      var item = e.target.closest('.search-result-item');
      if (!item) return;
      var type = item.dataset.type;
      var id = parseInt(item.dataset.id);
      results.classList.add('hidden');
      input.value = '';

      if (type === 'env') {
        addHistory('env', id);
        navigateTo('urls');
      } else {
        var tool = appState.data.tools.find(function(t) { return t.id === id; });
        if (tool) showToolDetail(tool);
      }
    });
  }

  function initThemeToggle() {
    $('#themeToggle').addEventListener('click', function() {
      setTheme(appState.theme === 'dark' ? 'light' : 'dark');
    });
  }

  function initHashRouting() {
    window.addEventListener('hashchange', function() {
      renderRoute(getRoute());
    });
  }

  window.app = {
    refreshStatus: function() {
      apiFetch('/status').then(function(statusData) {
        statusData.env_statuses.forEach(function(s) {
          appState.envStatuses[s.id] = s.status;
        });
        updateStatusIndicators();
        toast('状态已刷新', 'success');
      }).catch(function() {
        toast('刷新失败', 'error');
      });
    },
    showToast: toast
  };

  // 渐进式拆分：把 app.js 内的公共函数/状态挂到 ToolchainApp 命名空间，
  // 供后续新模块（modules/*.js）调用。旧代码零改动。
  if (window.ToolchainApp) {
    var TA = window.ToolchainApp;
    // 状态与常量（引用同一对象，app.js 与 modules 共享）
    TA.appState = appState;
    TA.PAGE_CONFIG = PAGE_CONFIG;
    TA.DEFAULT_MENU_ORDER = DEFAULT_MENU_ORDER;
    TA.ADMIN_PAGES = ADMIN_PAGES;
    TA.DEFAULT_USER_PAGES = DEFAULT_USER_PAGES;
    TA.API_BASE = API_BASE;
    TA.WS_URL = WS_URL;
    // 工具函数（优先用 core.js 已挂载的，避免覆盖）
    TA.$ = TA.$ || $;
    TA.$$ = TA.$$ || $$;
    TA.toast = TA.toast || toast;
    TA.apiFetch = apiFetch;
    TA.escHtml = TA.escHtml || escHtml;
    TA.getUserDisplayName = TA.getUserDisplayName || getUserDisplayName;
    TA.formatDate = TA.formatDate || formatDate;
    TA.getNowString = TA.getNowString || getNowString;
    TA.hasPermission = TA.hasPermission || hasPermission;
    // app.js 独有的路由/数据/渲染函数（供 modules 调用）
    TA.navigateTo = navigateTo;
    TA.getRoute = getRoute;
    TA.hasPageAccess = hasPageAccess;
    TA.renderSidebar = renderSidebar;
    TA.renderRoute = renderRoute;
    TA.loadAllData = loadAllData;
    TA.loadPublicData = loadPublicData;
    TA.invalidateDataCache = invalidateDataCache;
    TA.showModal = showModal;
    TA.closeModal = closeModal;
    TA.refreshAllStatuses = refreshAllStatuses;
    TA.updateStatusIndicators = updateStatusIndicators;
    TA.getStatusText = getStatusText;
    TA.toggleFavorite = toggleFavorite;
    TA.addHistory = addHistory;
    TA.formatFileSize = formatFileSize;
    TA.buildEnvUrl = buildEnvUrl;
    TA.initIconSelector = initIconSelector;
    TA.loadCustomIcons = loadCustomIcons;
    TA.updateIconPreview = updateIconPreview;
    // 主题/topbar（供 modules 复用）
    TA.setTheme = setTheme;
    TA.setPrimaryColor = setPrimaryColor;
    TA.applyTheme = applyTheme;
    TA.updateTopbarUser = updateTopbarUser;
    TA.saveLocalSetting = saveLocalSetting;
  }

  loadTheme();
  loadLocalSettings();
  loadAuthState();
  initWebSocket();
  initGlobalSearch();
  initThemeToggle();
  initHashRouting();
})();