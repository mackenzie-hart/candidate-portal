const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function esc(text) {
  return decodeEntities(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function contentPath(...parts) {
  return path.join(ROOT, 'content', ...parts);
}

/** Bold only the first comma-separated segment on line 1; other lines stay plain (floors unbold). */
function formatAddressHtml(html) {
  const raw = String(html ?? '').trim();
  if (!raw || !/<br\s*\/?>/i.test(raw)) return raw;

  const stripInline = (line) =>
    line
      .replace(/<\/?strong>/gi, '')
      .replace(/<\/?[^>]+>/g, '')
      .trim();

  const lines = raw.split(/<br\s*\/?>/i).map(stripInline).filter(Boolean);
  if (!lines.length) return raw;

  const formatFirstLine = (text) => {
    const comma = text.indexOf(',');
    if (comma > 0) {
      const first = text.slice(0, comma).trim();
      const rest = text.slice(comma);
      return `<strong>${esc(first)}</strong>${esc(rest)}`;
    }
    return `<strong>${esc(text)}</strong>`;
  };

  const formatted = lines.map((line, i) => (i === 0 ? formatFirstLine(line) : esc(line)));
  return formatted.join('<br>');
}

function defaultFaqs() {
  return [
    {
      question: 'Lunch',
      answer:
        'If your interview loop includes lunch, your Recruiting Coordinator will confirm the details in advance. Please share any dietary restrictions with your coordinator as early as possible.',
    },
    {
      question: 'Technology & what to bring',
      answer:
        'Bring a valid government ID. A notebook and pen are welcome. Only bring a laptop if your recruiter requested a presentation. Please keep your phone on silent during interviews.',
    },
    {
      question: 'Reasonable accommodation request',
      answer:
        'Box is committed to providing reasonable accommodations for candidates. If you need an accommodation for your interview, please contact your <strong>Recruiting Coordinator</strong> as soon as possible so we can support you.',
    },
    {
      question: "What if I'm running late?",
      answer:
        "Contact your Recruiting Coordinator immediately. We'll do our best to adjust, but some sessions may need to be rescheduled.",
    },
  ];
}

function defaultRegistration() {
  return {
    label: 'Required',
    heading: 'Registration',
    cards: [
      {
        title: 'Photo ID',
        body:
          'Please bring a <strong>valid government-issued ID</strong>. You will need it for check-in.',
      },
      {
        title: 'NDA',
        body:
          'Before your scheduled interview, please ensure that you electronically sign our NDA using <strong>Box Sign</strong> through the link provided by your Recruiting Coordinator.',
        note:
          'All candidates are required to sign in order to begin their interview. If you have any questions regarding the NDA form, please reach out to your Recruiting Coordinator.',
      },
      {
        title: 'Arrival & departure',
        body:
          'Your interviewer or host will escort you during your visit. When you are finished, return any visitor badge to reception before you leave the building.',
      },
    ],
  };
}

function defaultContact() {
  return {
    label: 'Help',
    heading: 'Questions?',
    body:
      'Contact your <strong>Recruiting Coordinator</strong> using the email from your calendar invite or confirmation email.',
    email: 'recruiting@box.com',
    buttonText: 'Email recruiting',
  };
}

module.exports = {
  ROOT,
  esc,
  readJson,
  writeFile,
  contentPath,
  formatAddressHtml,
  defaultFaqs,
  defaultRegistration,
  defaultContact,
};
