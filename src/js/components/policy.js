// js/components/policy.js

let uiManager;
let helpers;

const elements = {};

/**
 * PDF থেকে ভেরিফাই করা নতুন ডিফল্ট সেকশন
 * উৎস: স্মার্ট ইভালুয়্যেট মডেল উইথ মোস্তফা স্যার (7).pdf
 */
const DEFAULT_SECTIONS = [
  {
    title: 'টিম গঠন',
    icon: 'fas fa-users',
    tone: 'indigo',
    rules: [
      'প্রতি গ্রুপে ৪-৬ জন শিক্ষার্থী থাকবে (স্ট্যান্ডার্ড ৫ জন)।',
      'ছেলে ও মেয়েদের জন্য আলাদা আলাদা গ্রুপ গঠন করা হবে।',
      'প্রতিটি শিক্ষার্থীর একটি নির্দিষ্ট গ্রুপভিত্তিক দায়িত্ব থাকবে।',
      'সহজে গ্রুপ স্টাডি করার জন্য একই বেঞ্চে বসার চেষ্টা করতে হবে।',
    ],
  },
  {
    title: 'ভূমিকা বণ্টন',
    icon: 'fas fa-sitemap',
    tone: 'emerald',
    rules: [
      'গ্রুপের ৫টি প্রধান দায়িত্ব: টিম লিডার, টাইম কিপার, রিসোর্স ম্যানেজার, রিপোর্টার, ও পিস মেকার।',
      'সদস্যদের দায়িত্ব পর্যবেক্ষণ ও আপডেট বিষয় ভিত্তিক শিক্ষককে জানাতে হবে (বিশেষত টিম লিডার)।',
      'যোগ্যতা অনুযায়ী, প্রতি ৪টি এসাইনমেন্ট পর টিম লিডার পরিবর্তন করা হবে।',
    ],
  },
  {
    title: 'মূল্যায়ন নিয়ম',
    icon: 'fas fa-clipboard-check',
    tone: 'amber',
    rules: [
      'প্রতিটি মূল্যায়ন মোট ৬০ নম্বরে , MCQ = 40 নম্বর,ওভারঅল = 100 নম্বর।',
      'মূল্যায়ন ৩টি অংশে বিভক্ত: এসাইনমেন্ট/টাস্ক (২০ নম্বর), টিম (১৫ নম্বর), এবং অগ্রগতি (২৫ নম্বর)।',
      'অগ্রগতি ২৫ নম্বর ৫টি ক্রাইটেরিয়ার উপর নির্ভরশীল।',
      // --- [এই লাইনটি আপনার অনুরোধে বাদ দেওয়া হয়েছে] ---
      // 'টপিক: ভালো করে শিখেছি (+১০), শুধু বুঝেছি (+৫), এখনো পারিনা (-৫)।',
      'অ্যাক্টিভিটি: প্রতিদিন বাড়ির কাজ (+৫), নিয়মিত উপস্থিতি (+১০)।',
    ],
  },
  {
    title: 'রেঙ্ক ও পুরস্কার',
    icon: 'fas fa-trophy',
    tone: 'purple',
    rules: [
      'প্রতি ৪টি এসাইনমেন্ট (বা ১ মাস) পর ফলাফল রেঙ্কনির্ধারণ করা হবে।',
      'সেরা ৩টি গ্রুপকে এবং সেরা টপ ১০ জন শিক্ষার্থীকে পুরষ্কৃত করা হবে।',
      'রেঙ্কবোর্ডে অন্তর্ভুক্তির জন্য গ্রুপকে কমপক্ষে ২টি এসাইনমেন্টে অংশগ্রহণ করতে হবে।',
      'প্রতিটি এসাইনমেন্টের ফলাফল পরবর্তী র্যাঙ্কিংয়ে প্রভাব ফেলবে।',
    ],
  },
];

const TONE_STYLES = {
  indigo: {
    icon: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-500',
    border: 'border-indigo-100',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-100',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-100',
  },
  purple: {
    icon: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
    border: 'border-purple-100',
  },
};

let policySections = [...DEFAULT_SECTIONS];

export function init(dependencies) {
  uiManager = dependencies.managers.uiManager;
  helpers = dependencies.utils;

  _cacheDOMElements();
  render();

  console.log('✅ Policy component initialized.');
  return { render, setPolicyData, expandAll, collapseAll };
}

export function render() {
  if (!elements.page || !elements.policySectionsContainer) return;

  const sections = Array.isArray(policySections) && policySections.length ? policySections : DEFAULT_SECTIONS;
  const cardsHtml = sections.map(_renderSectionCard).join('');

  elements.policySectionsContainer.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-2" aria-live="polite">
      ${cardsHtml}
    </div>
  `;
}

export function setPolicyData(list = []) {
  if (Array.isArray(list) && list.length) {
    policySections = list.map(_normalizeSection);
  } else {
    policySections = [...DEFAULT_SECTIONS];
  }
  render();
}

export function expandAll() {
  render();
}

export function collapseAll() {
  render();
}

function _cacheDOMElements() {
  elements.page = document.getElementById('page-group-policy');
  elements.policySectionsContainer = document.getElementById('policySections');
}



function _renderSectionCard(section, index) {
  const { title, icon, rules, tone } = section;
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.indigo;
  const ruleItems = rules
    .map(
      (rule) => `
        <li class="flex gap-3">
          <span class="mt-2 h-2 w-2 rounded-full ${toneStyle.dot}"></span>
          <span class="text-sm text-gray-600 dark:text-gray-300">${_escapeHtml(rule)}</span>
        </li>`
    )
    .join('');

  const step = helpers?.convertToBanglaNumber ? helpers.convertToBanglaNumber(String(index + 1)) : index + 1;

  return `
    <article class="rounded-2xl border ${
      toneStyle.border
    } bg-white dark:bg-gray-900/80 p-4 shadow-sm hover:shadow-xl transition-shadow duration-300">
      <div class="flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl ${toneStyle.icon}">
          <i class="${icon} text-base"></i>
        </span>
        <div>
          <p class="text-[10px] font-semibold text-gray-400">নিয়ম ${step}</p>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">${_escapeHtml(title)}</h3>
        </div>
      </div>
      <ul class="mt-3 space-y-1.5">${ruleItems}</ul>
    </article>
  `;
}

function _normalizeSection(section = {}) {
  const rules = Array.isArray(section.rules) ? section.rules.map((rule) => _formatText(rule)).filter(Boolean) : [];
  return {
    title: _formatText(section.title) || 'শিরোনামহীন নিয়ম',
    icon: section.icon || 'fas fa-book-open',
    tone: section.tone || 'indigo',
    rules: rules.length ? rules : ['এই সেকশনে নিয়ম যুক্ত করুন।'],
  };
}

function _formatText(value) {
  if (!value) return '';
  if (helpers?.ensureBengaliText && typeof helpers.ensureBengaliText === 'function') {
    return helpers.ensureBengaliText(value);
  }
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

function _escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
