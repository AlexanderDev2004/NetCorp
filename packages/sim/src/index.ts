/**
 * Public API of the simulation. The client imports only from this package root;
 * internal modules (net, protocols) are implementation details.
 */
export { createWorld, log } from './state.ts';
export { applyCommand, advanceTicks, deliverMail, openTicket, rewardMultiplier, phishAlertLevel, phishPayRepLoss, rackSlots, wearFailureChance, dailyWearChance, REPAIR_COST, TRADE_IN_CREDIT, CONTRACT_OFFERS, RACK_TIERS, TWIN_REPLACEMENT_PHISH, HARD_PAY_FACTOR, HARD_WEAR_FACTOR, PRESTIGE_DAY_TICKS, prestigeBreakdown, careerPrestige, SEASON_GOALS, nextSeasonGoal, contractFeeMult, devicePriceMult, repairCostMult, ticketRewardMult, devicePrice, repairCost, maybeRivalPoach, RIVAL_NAME, RIVAL_POACH_SCORE, RIVAL_MATCH_DISCOUNT } from './engine.ts';
export { findPath, findDhcpServers } from './net.ts';
export { firstMatch, packetAllowed } from './protocols/firewall.ts';
export { allocateAddress, findPool, poolAddressCount } from './protocols/dhcp.ts';
export { resolveLocal, resolveViaForwarder } from './protocols/dns.ts';
export { cidrContains, ipv4ToInt, prefixToMaskString, sameSubnet } from './ip.ts';
export * from './types.ts';
