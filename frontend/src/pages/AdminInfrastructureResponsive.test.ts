import fs from 'fs';
import path from 'path';

const readCss = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pageContracts = [
  {
    file: 'LogManagement.css',
    page: '.log-management',
    hero: '.log-management__hero',
    actions: '.log-management__actions',
    stats: '.log-management__stats',
  },
  {
    file: 'TrafficControl.css',
    page: '.traffic-control',
    hero: '.traffic-control__hero',
    actions: '.traffic-control__actions',
    stats: '.traffic-control__stats',
  },
  {
    file: 'AlertManagement.css',
    page: '.alert-management',
    hero: '.alert-management__hero',
    actions: '.alert-management__actions',
    stats: '.alert-management__stats',
  },
  {
    file: 'IpBlacklistManagement.css',
    page: '.ip-blacklist',
    hero: '.ip-blacklist__hero',
    actions: '.ip-blacklist__actions',
    stats: '.ip-blacklist__stats',
  },
  {
    file: 'RegistryManagement.css',
    page: '.registry-management',
    hero: '.registry-management__hero',
    stats: '.registry-management__stats',
  },
];

describe('Admin infrastructure responsive containment', () => {
  it('keeps infrastructure pages within phone, landscape, and tablet shells', () => {
    for (const contract of pageContracts) {
      const css = readCss(contract.file);
      const f2760Start = css.indexOf('/* F2760: admin infrastructure controls must fit phone, landscape and tablet shells. */');
      const f2760Css = css.slice(f2760Start);

      expect(f2760Start).toBeGreaterThanOrEqual(0);
      expect(f2760Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
      expect(f2760Css).toMatch(new RegExp(`${escapeRegExp(contract.page)}\\s*\\{[\\s\\S]*?grid-template-columns:\\s*minmax\\(0,\\s*1fr\\)\\s*!important;[\\s\\S]*?overflow-x:\\s*clip\\s*!important;`));
      expect(f2760Css).toMatch(new RegExp(`${escapeRegExp(contract.hero)}[\\s\\S]*?\\{[\\s\\S]*?display:\\s*grid\\s*!important;[\\s\\S]*?grid-template-columns:\\s*minmax\\(0,\\s*1fr\\)\\s*!important;`));
      expect(f2760Css).toMatch(new RegExp(`${escapeRegExp(contract.stats)}\\s*\\{[\\s\\S]*?display:\\s*grid\\s*!important;[\\s\\S]*?grid-template-columns:\\s*repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)\\s*!important;[\\s\\S]*?overflow:\\s*visible\\s*!important;[\\s\\S]*?scroll-snap-type:\\s*none\\s*!important;`));
      expect(f2760Css).toMatch(new RegExp(`${escapeRegExp(contract.page)} \\.ant-table-wrapper\\s*\\{[\\s\\S]*?overflow-x:\\s*auto\\s*!important;`));

      if (contract.actions) {
        expect(f2760Css).toMatch(new RegExp(`${escapeRegExp(contract.actions)}[\\s\\S]*?\\{[\\s\\S]*?display:\\s*grid\\s*!important;[\\s\\S]*?gap:\\s*8px\\s*!important;[\\s\\S]*?justify-content:\\s*stretch\\s*!important;`));
      }
    }
  });
});
