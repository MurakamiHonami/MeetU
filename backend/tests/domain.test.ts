import { describe, it, expect } from 'vitest';
import { TagNormalizer } from '../src/domain/tag/TagNormalizer';
import { Card } from '../src/domain/card/Card';
import { MatchingEngine } from '../src/domain/match/MatchingEngine';
import { User } from '../src/domain/user/User';

describe('Domain Logic Tests', () => {
  it('TagNormalizer normalizes full-width and symbols correctly', () => {
    expect(TagNormalizer.normalize('プロセカ / 天馬司')).toBe('プロセカ天馬司');
    expect(TagNormalizer.normalize('ﾌﾟﾛｾｶ_天馬司!')).toBe('プロセカ天馬司');
  });

  it('MatchingEngine matches cards when tags match threshold', () => {
    const ownerCard = Card.create({
      ownerId: 'user_1',
      type: 'WANT',
      title: '司アクスタ求め',
      minMatchCount: 2,
      tags: ['プロセカ', '天馬司', 'アクスタ'],
      requiredTags: [],
      dates: [],
    });

    const targetCard = Card.create({
      ownerId: 'user_2',
      type: 'GIVE',
      title: '司アクスタ譲ります',
      minMatchCount: 2,
      tags: ['プロセカ', '天馬司', '缶バッジ'],
      requiredTags: [],
      dates: [],
    });

    const matchedTags = ['プロセカ', '天馬司'];
    const result = MatchingEngine.evaluate(ownerCard, targetCard, matchedTags);

    expect(result).not.toBeNull();
    expect(result?.match.matchCount).toBe(2);
    expect(result?.notifyOwner).toBe(true);
    expect(result?.notifyTarget).toBe(true);
  });

  it('MatchingEngine fails when required tags are missing', () => {
    const ownerCard = Card.create({
      ownerId: 'user_1',
      type: 'WANT',
      title: '司アクスタ求め',
      minMatchCount: 1,
      tags: ['プロセカ', '天馬司'],
      requiredTags: ['アクスタ'],
      dates: [],
    });

    const targetCard = Card.create({
      ownerId: 'user_2',
      type: 'GIVE',
      title: '司缶バッジ譲ります',
      minMatchCount: 1,
      tags: ['プロセカ', '天馬司'],
      requiredTags: [],
      dates: [],
    });

    const result = MatchingEngine.evaluate(ownerCard, targetCard, ['プロセカ', '天馬司']);
    expect(result).toBeNull();
  });

  it('User report count triggers suspension at 3 reports', () => {
    const user = User.create('test@example.com', 'hash', 'salt', 'TestUser');
    expect(user.isSuspended()).toBe(false);

    user.incrementReport();
    user.incrementReport();
    expect(user.isSuspended()).toBe(false);

    user.incrementReport();
    expect(user.isSuspended()).toBe(true);
  });
});
