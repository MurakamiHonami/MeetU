import { Card } from '../../domain/card/Card';
import { Match, MatchStatus } from '../../domain/match/Match';
import { TradeGroup } from '../../domain/group/TradeGroup';
import { Message } from '../../domain/message/Message';
import { User } from '../../domain/user/User';
import { TradeStep } from '../../domain/group/TradeGroup';

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  PENDING: '提案中',
  ACCEPTED: '成立',
  DECLINED: '辞退',
  COMPLETED: '交換完了',
};

export const GROUP_STATUS_LABEL: Record<string, string> = {
  NEW: '提案中',
  ACCEPTED: '成立',
  DECLINED: '解散',
  COMPLETED: '交換完了',
};

export function ownerView(user: User) {
  const labels = user.favoriteLabels;
  return {
    userId: user.id,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    ratingAvg: user.ratingCount ? user.ratingAvg : null,
    ratingCount: user.ratingCount,
    tradeCount: user.tradeCount,
    isNew: user.ratingCount === 0,
    favorites: user.favoriteTags.map((tagId) => ({
      tagId,
      name: labels[tagId] ?? tagId,
    })),
    homeLocation: user.homeLocation?.toJSON() ?? null,
  };
}

export function cardView(
  card: Card,
  owner?: User,
  matchedTags?: string[],
  extras?: { score?: number; reasonTags?: string[]; distanceKm?: number; distanceLabel?: string }
) {
  const labels = card.tagLabels;
  const view: Record<string, unknown> = {
    cardId: card.id,
    type: card.type,
    title: card.title,
    note: card.note,
    tags: card.tags.map((tagId) => ({ tagId, name: labels[tagId] ?? tagId })),
    requiredTags: card.requiredTags.map((t) => labels[t] ?? t),
    minMatchCount: card.minMatchCount,
    status: card.status,
    createdAt: card.createdAt,
  };
  if (card.dates.length > 0) view.dates = card.dates;
  if (card.location) view.location = card.location.toJSON();
  if (owner) view.owner = ownerView(owner);
  if (matchedTags) {
    view.matchedTags = matchedTags.map((t) => labels[t] ?? t);
    view.matchCount = matchedTags.length;
  }
  if (extras?.score !== undefined) view.score = extras.score;
  if (extras?.reasonTags) {
    view.reasonTags = extras.reasonTags.map((t) => labels[t] ?? t);
  }
  if (extras?.distanceKm !== undefined) view.distanceKm = extras.distanceKm;
  if (extras?.distanceLabel) view.distanceLabel = extras.distanceLabel;
  return view;
}

export function matchView(
  match: Match,
  userId: string,
  partner: User | null,
  partnerCard: Card | null,
  myCard: Card | null,
  iGive: Card | null,
  iReceive: Card | null,
  lastReadAt: string | null
) {
  const isA = match.userAId === userId;
  const acceptedByMe = isA ? match.acceptedA : match.acceptedB;
  const acceptedByPartner = isA ? match.acceptedB : match.acceptedA;
  const canChat = match.status === 'ACCEPTED' || match.status === 'COMPLETED';
  const hasUnread = !!(
    match.lastMessageAt &&
    match.lastMessageBy !== userId &&
    String(match.lastMessageAt) > String(lastReadAt ?? '')
  );

  return {
    matchId: match.id,
    status: match.status,
    statusLabel: MATCH_STATUS_LABEL[match.status],
    matchCount: match.matchCount,
    matchedTags: match.matchedLabels,
    createdAt: match.createdAt,
    acceptedByMe,
    acceptedByPartner,
    distanceLabel: match.distanceKm != null ? `${match.distanceKm.toFixed(1)}km` : undefined,
    canChat,
    hasUnread,
    lastMessagePreview: match.lastMessagePreview,
    lastMessageAt: match.lastMessageAt,
    partner: partner ? ownerView(partner) : null,
    partnerCard: partnerCard ? cardView(partnerCard) : null,
    myCard: myCard ? cardView(myCard) : null,
    iGive: iGive ? cardView(iGive) : null,
    iReceive: iReceive ? cardView(iReceive) : null,
  };
}

export function groupView(
  group: TradeGroup,
  userId: string,
  users: Map<string, User>,
  cards: Map<string, Card>,
  lastReadAt: string | null
) {
  const userOf = (uid: string) => {
    const u = users.get(uid);
    return u ? ownerView(u) : { userId: uid, displayName: '不明', ratingAvg: null, ratingCount: 0, tradeCount: 0, isNew: true };
  };
  const cardOf = (cid: string) => cards.get(cid) ?? null;

  const steps = group.steps.map((step: TradeStep) => {
    const give = cardOf(step.giveCardId);
    return {
      from: userOf(step.fromUserId),
      to: userOf(step.toUserId),
      card: give ? cardView(give) : null,
      matchedTags: step.matchedLabels,
      isMine: step.fromUserId === userId,
    };
  });

  const giveStep = group.myGiveStep(userId);
  const receiveStep = group.myReceiveStep(userId);
  const responses = group.responses;
  const canChat = group.isChattable();
  const hasUnread = !!(
    group.lastMessageAt &&
    group.lastMessageBy !== userId &&
    String(group.lastMessageAt) > String(lastReadAt ?? '')
  );

  return {
    groupId: group.id,
    length: group.length,
    status: group.status,
    statusLabel: GROUP_STATUS_LABEL[group.status] ?? group.status,
    createdAt: group.createdAt,
    steps,
    members: group.members.map((m) => userOf(m)),
    myAnswer: responses[userId],
    acceptedCount: group.acceptedCount(),
    iGive: giveStep && cardOf(giveStep.giveCardId) ? cardView(cardOf(giveStep.giveCardId)!) : null,
    iGiveTo: giveStep ? userOf(giveStep.toUserId) : null,
    iReceive: receiveStep && cardOf(receiveStep.giveCardId) ? cardView(cardOf(receiveStep.giveCardId)!) : null,
    iReceiveFrom: receiveStep ? userOf(receiveStep.fromUserId) : null,
    canChat,
    lastMessagePreview: group.lastMessagePreview,
    hasUnread,
  };
}

export async function messageView(
  message: Message,
  userId: string,
  getImageUrl: (key: string) => Promise<string | null>
) {
  const view: Record<string, unknown> = {
    messageId: message.id,
    text: message.text ?? '',
    createdAt: message.createdAt,
    mine: message.senderId === userId,
    kind: message.kind,
  };
  if (message.imageKey) {
    view.imageUrl = await getImageUrl(message.imageKey);
  }
  if (message.location) {
    view.location = message.location.toJSON();
  }
  return view;
}
