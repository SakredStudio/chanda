// Pure ES module for collection tally calculations, per-person vs total splits with remainder paise (no DOM)

/**
 * Split a total integer paise amount across `count` people so the sum of integer paise shares equals `totalPaise`.
 * Remainder paise (totalPaise % count) are distributed 1 paise each to the first `remainderPaise` people.
 * @param {number} totalPaise
 * @param {number} count
 * @returns {{ baseAmountPaise: number, remainderPaise: number, shares: number[] }}
 */
export function splitTotalAmount(totalPaise, count) {
  const total = Math.max(0, Math.round(Number(totalPaise) || 0));
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) {
    return { baseAmountPaise: 0, remainderPaise: 0, shares: [] };
  }
  const baseAmountPaise = Math.floor(total / n);
  const remainderPaise = total % n;
  const shares = Array.from({ length: n }, (_, idx) =>
    idx < remainderPaise ? baseAmountPaise + 1 : baseAmountPaise
  );
  return { baseAmountPaise, remainderPaise, shares };
}

/**
 * Return the amount in paise due for a specific person in a collection.
 * @param {object} collection
 * @param {object} person
 * @param {number} [index=0]
 * @returns {number}
 */
export function getPersonSharePaise(collection, person, index = 0) {
  if (person && typeof person.amountPaise === 'number' && Number.isFinite(person.amountPaise)) {
    return Math.round(person.amountPaise);
  }
  const peopleCount = Array.isArray(collection?.people) ? collection.people.length : 0;
  if (collection?.amountMode === 'total' && collection?.totalTargetPaise > 0 && peopleCount > 0) {
    const { shares } = splitTotalAmount(collection.totalTargetPaise, peopleCount);
    return shares[index] ?? shares[shares.length - 1] ?? 0;
  }
  const perPerson =
    typeof collection?.amountPerPersonPaise === 'number'
      ? collection.amountPerPersonPaise
      : typeof collection?.amountPerPerson === 'number'
        ? collection.amountPerPerson
        : 0;
  return Math.round(perPerson);
}

/**
 * Compute full tally for a collection (paid/pending counts, collected/total/pending paise, percentage).
 * @param {object} collection
 */
export function computeTally(collection) {
  const people = Array.isArray(collection?.people) ? collection.people : [];
  const totalCount = people.length;

  let collectedPaise = 0;
  let sumAllSharesPaise = 0;
  let paidCount = 0;
  const paidPeople = [];
  const pendingPeople = [];

  people.forEach((person, idx) => {
    const share = getPersonSharePaise(collection, person, idx);
    sumAllSharesPaise += share;
    if (person.status === 'paid') {
      paidCount += 1;
      collectedPaise += share;
      paidPeople.push(person);
    } else {
      pendingPeople.push(person);
    }
  });

  const pendingCount = totalCount - paidCount;
  const totalPaise =
    collection?.amountMode === 'total' && typeof collection?.totalTargetPaise === 'number' && collection.totalTargetPaise > 0
      ? Math.round(collection.totalTargetPaise)
      : sumAllSharesPaise;

  const pendingPaise = Math.max(0, totalPaise - collectedPaise);
  const percent =
    totalPaise > 0 ? Math.min(100, Math.round((collectedPaise / totalPaise) * 100)) : 0;

  const perPersonDisplayPaise =
    collection?.amountMode === 'total' && totalCount > 0
      ? Math.round(totalPaise / totalCount)
      : Math.round(
          collection?.amountPerPersonPaise ?? collection?.amountPerPerson ?? 0
        );

  return {
    totalCount,
    paidCount,
    pendingCount,
    collectedPaise,
    totalPaise,
    pendingPaise,
    percent,
    perPersonDisplayPaise,
    paidPeople,
    pendingPeople
  };
}
