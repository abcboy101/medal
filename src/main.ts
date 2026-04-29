import i18n, { type Language } from './i18n';

import './style.css';
import './event-list.css';
import './event-details.css';
import './medal-list.css';

const app = document.getElementById('app')!;
const eventList = document.getElementsByTagName('nav')[0];
const eventDetail = document.getElementsByTagName('main')[0];
const eventDetailMedal = document.getElementsByTagName('aside')[0];

app.classList.add('loading');

function parseVersion(ver: string | null) {
  let verAsNumber = Number(ver);
  if (Number.isNaN(verAsNumber))
    verAsNumber = 0;
  return verAsNumber;
}

function getMaxVer(id: string) {
  for (const ev of loadedEventList)
    if (ev.id === id)
      return ev.version;
  return 0;
}

/**
 * Calculates the scrollbar width for the current view and sets the corresponding CSS variables.
 */
function updateScrollbarWidth() {
  let container: HTMLElement;
  switch (app.getAttribute('data-page')) {
    case 'event-list':
      container = eventList;
      break;
    case 'event-detail':
      container = eventDetail;
      break;
    case 'event-detail-medal':
      container = eventDetailMedal.getElementsByClassName('medal-list-container')[0] as HTMLElement;
      break;
    default:
      container = document.body;
      break;
  }
  const scrollbarWidth = container.offsetWidth - container.clientWidth;
  document.documentElement.scrollTop = document.body.scrollTop = 0;
  document.body.style.setProperty('--has-scrollbar', scrollbarWidth > 0 ? '1' : '0');
  document.body.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
}
window.addEventListener('resize', updateScrollbarWidth);

/**
 * Converts a numeric language index to an IETF language tag.
 */
function getLang(lang: number): string {
  return [null, 'ja', 'en', 'fr', 'it', 'de', null, 'es', 'ko', 'zh-Hans', 'zh-Hant', 'es-419'][lang] ?? 'en';
}

//#region Routing
/**
 * Loads and displays the requested content in the current window.
 */
async function routeAsync() {
  const params = new URLSearchParams(location.search);
  try {
    await loadEventList();
    if (params.has('id')) {
      await loadEventDetails(params.get('id')!, parseVersion(params.get('ver')));
      if (location.hash === '#medals')
        app.setAttribute('data-page', 'event-detail-medal');
      else
        app.setAttribute('data-page', 'event-detail');
    }
    else {
      await initEventList();
      app.setAttribute('data-page', 'event-list');
    }
    app.classList.remove('loading');
    updateScrollbarWidth();
  }
  catch (e) {
    console.error(e);
    history.replaceState(null, "", location.pathname);
    await routeAsync();
  }
}

function route() {
  routeAsync().catch(console.error);
}
window.addEventListener("popstate", route);

/**
 * Loads and displays the requested event details.
 *
 * This method uses `pushState` and `route` to perform the request in the current window.
 */
function viewEventDetails(e: MouseEvent) {
  e.preventDefault();
  const link = e.currentTarget as HTMLAnchorElement;
  history.pushState(null, "", link.href);
  routeAsync().then(() => {
    eventDetail.scrollTop = 0;
  }).catch(console.error);
}

/**
 * Closes the current view and navigates to the previous view.
 * (i.e., event-list <-- event-detail <-- event-detail-medal)
 */
function close() {
  const params = new URLSearchParams(location.search);
  if (params.has('id') && location.hash === '#medals')
    history.pushState(null, "", location.pathname + location.search);
  else
    history.pushState(null, "", location.pathname);
  route();
}

document.getElementById('close')!.addEventListener('click', close);

/**
 * Navigates to the previous or next version of the currently viewed event.
 */
function navigateVersion(direction: number) {
  const params = new URLSearchParams(location.search);
  const newVer = parseVersion(params.get('ver')) + direction;

  if (newVer >= 0 && newVer <= getMaxVer(params.get('id')!)) {
    params.set('ver', newVer.toString())
    history.pushState(null, "", '?' + params.toString() + location.hash);
  }
  route();
}

const btnPrev = document.getElementById('previous') as HTMLButtonElement;
const btnNext = document.getElementById('next') as HTMLButtonElement;
btnPrev.addEventListener('click', () => { navigateVersion(-1); });
btnNext.addEventListener('click', () => { navigateVersion(1); });
//#endregion

//#region Event list
interface MedalEvent {
  id: string,
  version: number,
  language: number,
  title: string,
  category: string,
  image: string,
  location: string,
  timestamp: number,
}

let loadedEventList: MedalEvent[] = [];
let initializedEventList = false;

/**
 * Fetches the event list from the server.
 */
async function loadEventList() {
  if (loadedEventList.length > 0)
    return;
  const res = await fetch('./event-list.json');
  const data = res.ok ? (await res.json() as MedalEvent[]) : [];
  data.sort((a, b) => b.timestamp - a.timestamp);
  loadedEventList = data;
}

/**
 * Initializes the event list view.
 */
async function initEventList() {
  if (initializedEventList)
    return;
  await loadEventList();
  if (loadedEventList.length > 0) {
    const eventList = document.getElementById('event-list')!;
    eventList.innerHTML = loadedEventList.map((ev) => {
      const date = new Date(ev.timestamp * 1000);
      const lang = getLang(ev.language);
      return (
      `<a class="event" href="?id=${ev.id}${ev.version === 0 ? '' : `&ver=${ev.version}`}">
        <img src="${import.meta.env.BASE_URL}images/event/${ev.image}" alt="" loading="lazy" />
        <div lang="${lang}"><span class="category">${ev.category}</span></div>
        <h2 lang="${lang}" class="title">${ev.title}</h2>
        <time datetime="${date.toISOString()}">${date.toLocaleDateString(document.documentElement.lang)}</time>
      </a>`
      );
    }).join('');
    for (const link of eventList.children)
      (link as HTMLElement).addEventListener('click', viewEventDetails);
  }

  const locationLangs = new Map(loadedEventList.map((ev) => [ev.location, ev.language]));
  const locations = Array.from(locationLangs.keys());
  const collator = new Intl.Collator(document.documentElement.lang);
  locations.sort((a, b) => collator.compare(a, b));
  locationLangs.set('—', 2);
  locations.unshift('—');
  select.innerHTML = locations.map((location) => `<option lang="${getLang(locationLangs.get(location)!)}">${location}</option>`).join('');
  initializedEventList = true;
}

// Open/close the search dropdown when clicking on the header
const dropdown = document.getElementsByTagName('search')[0];
const select = document.getElementById('search') as HTMLSelectElement;
dropdown.querySelectorAll('.dropdown-header > :not(button)').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (dropdown.classList.toggle('open'))
      select.focus();
  });
});

// Close the search dropdown when clicking on the reset button in the header
dropdown.querySelector('.dropdown-header button[type="reset"]')!.addEventListener('click', () => {
  select.blur();
  dropdown.classList.remove('open');
});

/**
 * Filter the event list based on the selected location.
 */
function filterEventList() {
  const selected = select.options[select.selectedIndex];
  select.lang = selected.lang;

  const events = eventList.getElementsByClassName('event') as HTMLCollectionOf<HTMLElement>;
  let filterCount = 0;
  for (let i = 0; i < loadedEventList.length; i++) {
    if (select.selectedIndex === 0 || loadedEventList[i].location === selected.innerText) {
      events[i].removeAttribute('style');
      filterCount++;
    }
    else {
      events[i].style.display = 'none';
    }
  }

  document.getElementById('filter-current')!.innerText = filterCount.toString();
  document.getElementById('filter-total')!.innerText = loadedEventList.length.toString();

  if (select.selectedIndex === 0) {
    dropdown.classList.add('inactive');
    dropdown.classList.remove('active');
  }
  else {
    dropdown.classList.remove('inactive');
    dropdown.classList.add('active');
  }
  updateScrollbarWidth();
}

select.addEventListener('change', filterEventList);
dropdown.getElementsByTagName('form')[0].addEventListener('reset', () => {
  select.selectedIndex = 0;
  filterEventList();
});
//#endregion

//#region Event details
interface MedalEventDetails extends Omit<MedalEvent, 'id' | 'version'> {
  description: string,
  url: string,
  medals: string[],
}

let loadedEventDetails: string | null = null;

/**
 * Fetches the event details from the server.
 */
async function loadEventDetails(id: string, ver: number) {
  const filename = ver === 0 ? id : `${id}@v${ver}`;
  if (loadedEventDetails === filename)
    return; // already loaded

  const res = await fetch(`./meta/${filename}.json`);
  if (!res.ok)
    throw new Error(`HTTP ${res.status} (${res.statusText})`);
  const ev = await res.json() as MedalEventDetails;
  initEventDetails(ev);
  initMedalList(ev);

  btnPrev.disabled = ver === 0;
  btnNext.disabled = ver === getMaxVer(id);
  loadedEventDetails = filename;
}

/**
 * Initializes the event details view.
 */
function initEventDetails(ev: MedalEventDetails) {
  const detailImg: HTMLImageElement = eventDetail.getElementsByTagName('img')[0];
  const detailCat = eventDetail.getElementsByClassName('category')[0] as HTMLElement;
  const detailTitle = eventDetail.getElementsByTagName('h2')[0] as HTMLElement;
  const detailDesc = eventDetail.getElementsByTagName('p')[0] as HTMLElement;

  detailImg.src = `${import.meta.env.BASE_URL}images/event/${ev.image}`;
  detailCat.lang = detailTitle.lang = detailDesc.lang = getLang(ev.language);
  detailCat.innerText = ev.category;
  detailTitle.innerText = ev.title;
  detailDesc.innerText = ev.description;
  initEventDetailsURL(ev.url);
}

/**
 * Initializes the URL section of the event details view.
 */
function initEventDetailsURL(url: string) {
  const section = eventDetail.getElementsByTagName('section')[0];
  const textUrl = section.getElementsByClassName('url')[0] as HTMLElement;
  const linkUrl = section.getElementsByClassName('go-to-url')[0] as HTMLAnchorElement;

  section.style.display = url ? '' : 'none';
  textUrl.innerText = linkUrl.href = url;
}

/**
 * Initializes the medal list view.
 */
function initMedalList(ev: MedalEventDetails) {
  const medalHeader = eventDetailMedal.getElementsByTagName('h2')[0];
  const medalList = eventDetailMedal.getElementsByClassName('medal-list')[0];

  medalHeader.lang = getLang(ev.language);
  medalHeader.innerText = ev.title;
  medalList.innerHTML = ev.medals.map((clc) =>
    `<img src="${import.meta.env.BASE_URL}images/medal/${clc}" alt="" loading="lazy" />`
  ).join('');
}
//#endregion

//#region Localization
function localize(lang: Language) {
  try {
    document.documentElement.lang = lang;
    document.title = i18n[lang].sp_medal_event_list_title;
    for (const [key, value] of Object.entries(i18n[lang])) {
      document.getElementById(key)!.innerText = value;
    }
  }
  catch (e) {
    console.error(e)
    localize('en');
  }
}

function isLangValid(lang: string | null): lang is Language {
  return Object.keys(i18n).includes(lang ?? '');
}

function getNavigatorLanguage() {
  const locale = new Intl.Locale(navigator.language).maximize();
  if (locale.language !== 'zh')
    return locale.language;
  return locale.language + '-' + (locale.script ?? 'Hans');
}

let lng;
if (isLangValid(lng = new URLSearchParams(location.search).get('lng'))
    || isLangValid(lng = localStorage.getItem('i18nextLng'))
    || isLangValid(lng = getNavigatorLanguage())) {
  localize(lng);
}
route();
//#endregion
