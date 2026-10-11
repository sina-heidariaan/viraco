import { removesLastActiveOwner } from './last-owner.rule';
import { Role } from './role.enum';

describe('removesLastActiveOwner', () => {
  const owner = { id: 'a', role: Role.Owner, isActive: true };

  it.each([
    ['disabling', { isActive: false }],
    ['downgrading to manager', { role: Role.Manager }],
    ['downgrading to member', { role: Role.Member }],
  ])('refuses %s the only active owner', (_label, change) => {
    expect(removesLastActiveOwner(owner, change, ['a'])).toBe(true);
  });

  it('allows it when another active owner remains', () => {
    expect(removesLastActiveOwner(owner, { isActive: false }, ['a', 'b'])).toBe(false);
  });

  it('allows changes that keep the owner an active owner', () => {
    expect(removesLastActiveOwner(owner, { role: Role.Owner, isActive: true }, ['a'])).toBe(false);
    expect(removesLastActiveOwner(owner, {}, ['a'])).toBe(false);
  });

  it('ignores targets that are not active owners', () => {
    expect(removesLastActiveOwner({ id: 'm', role: Role.Manager, isActive: true }, { isActive: false }, ['a'])).toBe(false);
    expect(removesLastActiveOwner({ id: 'x', role: Role.Owner, isActive: false }, { role: Role.Member }, ['a'])).toBe(false);
  });
});
