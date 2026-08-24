import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.resolve(__dirname, 'SeckillManagement.tsx'), 'utf8');
const styleSource = fs.readFileSync(path.resolve(__dirname, 'SeckillManagement.css'), 'utf8');

describe('SeckillManagement', () => {
  it('keeps campaign controls and validation in the admin surface', () => {
    expect(pageSource).toContain('adminApi.getSeckillCampaigns()');
    expect(pageSource).toContain('adminApi.createSeckillCampaign(payload)');
    expect(pageSource).toContain('adminApi.updateSeckillCampaign(editing.id, payload)');
    expect(pageSource).toContain('validateItems');
    expect(pageSource).toContain('admin-seckill__items');
  });

  it('keeps the campaign editor usable on phone widths', () => {
    expect(styleSource).toContain('@media (max-width: 720px)');
    expect(styleSource).toContain('.admin-seckill__items {\n    grid-template-columns: 1fr;');
    expect(styleSource).toContain('.admin-seckill__formGrid,\n  .admin-seckill__draftNumbers {\n    grid-template-columns: 1fr;');
    expect(styleSource).toContain('max-height: calc(100dvh - 150px);');
  });
});
