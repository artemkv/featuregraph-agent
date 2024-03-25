const { makeChannel } = require('msg-channel-js');
const { v4: uuidv4 } = require('uuid');
const { getJson, postJson } = require('./restapi');

const FG_GLOBAL_NAMESPACE = 'featuregraph.net';
const SESSION_STORAGE_PREV_EVT = 'featuregraph.net.prev_evt';
// TODO:
const INGEST_ENDPOINT = 'http://localhost:8600/events';
const CONFIG_ENDPOINT = 'http://localhost:8600/appconfig';

let config = {};

const init = async () => {
    // Sanitize the config
    config = window[FG_GLOBAL_NAMESPACE].config;
    if (!config.acc) {
        throw new Error('Account ID ("acc") must be provided.');
    }
    if (!config.aid) {
        throw new Error('Application ID ("aid") must be provided.');
    }

    const appConfig = await getJson(`${CONFIG_ENDPOINT}/${config.acc}/${config.aid}`);
    // TODO: validate the format
    try {
        const parsed = JSON.parse(appConfig.config);
        config.feature_selectors = parsed.feature_selectors;
    } catch {
        throw new Error('Invalid application config.');
    }

    // Detect prod environment
    if (config.prod_hostname && config.prod_hostname === window.location.hostname) {
        config.isProd = true;
    } else {
        config.isProd = false;
    }

    // Attach to events to listen
    const channel = makeChannel();
    attachEventHandlers(channel);

    // Initialization is complete, now we can start processing messages
    channel.attachHandler(processEvent);
}

const attachEventHandlers = (channel) => {
    document.addEventListener('click', (e) => {
        channel.write({ e });
    }, { capture: true });
};

const mapToFeature = (element, selectors) => {
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        if (element.matches(selector.css)) {
            return [selector.feature, true];
        }
    }
    return [null, false];
}

const getNewId = () => uuidv4();

const loadLastEvent = () => {
    return JSON.parse(sessionStorage.getItem(SESSION_STORAGE_PREV_EVT));
};

const saveLastEvent = evt => {
    sessionStorage.setItem(SESSION_STORAGE_PREV_EVT, JSON.stringify(evt));
};

const processEvent = async msg => {
    const e = msg.e;
    const target = e.target;
    const selectors = config.feature_selectors;

    let [feature, mapped] = mapToFeature(target, selectors);
    if (!mapped) {
        return;
    }

    const id = getNewId();
    const prevEvt = loadLastEvent();

    const evt = {
        id,
        f: feature,
        prev: prevEvt
            ? {
                id: prevEvt.id,
                f: prevEvt.f
            } : null
    };

    saveLastEvent(evt);

    const events = {
        t: 'events',
        v: '1.0.0',
        acc: config.acc,
        aid: config.aid,
        is_prod: config.isProd,
        evts: [evt]
    };

    await postJson(INGEST_ENDPOINT, events);
};

(async function () {
    try {
        await init();
    } catch (e) {
        console.error('Failed to initialize FeatureGraph agent.', e);
    }
}());

