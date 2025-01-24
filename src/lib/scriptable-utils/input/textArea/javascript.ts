import { escapeQuotesHTML } from '../../string'
import { IDS, ON_TEXT_AREA_CHANGE } from './consts'

export const getHeadJavascript = (initVal: string) => `
const runFnOnElIfExists = (selector, fn) => {
  const el = document.querySelector(selector);
  return el ? fn(el) : null;
};

const setIsButtonDisabled = (id, isDisabled) =>
  runFnOnElIfExists('#' + id, el =>
    isDisabled ? (el.disabled = true) : el.removeAttribute('disabled')
  );

const ${ON_TEXT_AREA_CHANGE} = () => {
  const inputVal = document.querySelector('textarea').value;
  setIsButtonDisabled('${IDS.RESET_BUTTON_ID}', inputVal === \`${escapeQuotesHTML(initVal)}\`);
  setIsButtonDisabled('${IDS.CLEAR_BUTTON_ID}', !inputVal);
};

const setVal = val =>
  runFnOnElIfExists('textarea', el => {
    el.value = val;
    onTextAreaChange();
  });

const addListener = (selector, fn, eventType = 'click') =>
  runFnOnElIfExists(selector, el => el.addEventListener(eventType, fn));

document.addEventListener('DOMContentLoaded', () => {
  addListener('#${IDS.RESET_BUTTON_ID}', () =>
    setVal(\`${escapeQuotesHTML(initVal)}\`)
  );
  addListener('#${IDS.CLEAR_BUTTON_ID}', () => setVal(''));
  addListener('textarea', ${ON_TEXT_AREA_CHANGE}, 'input');
});
`
