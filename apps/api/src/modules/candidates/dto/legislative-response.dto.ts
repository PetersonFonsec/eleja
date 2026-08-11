import type {
  LegislativeMandate,
  LegislativeProposalAuthor,
  LegislativeVote,
  ParliamentaryExpense,
} from '@eleja/database';
export function mandateDto(item: LegislativeMandate) {
  return {
    id: item.id,
    body: item.body,
    legislatureNumber: item.legislatureNumber,
    state: item.state,
    partyAcronym: item.partyAcronym,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    status: item.status,
    sourceStatus: item.sourceStatus,
  };
}
export function proposalDto(author: LegislativeProposalAuthor) {
  const proposal = author.proposal;
  return {
    id: proposal.id,
    source: proposal.source,
    type: proposal.type,
    number: proposal.number,
    year: proposal.year,
    title: proposal.title,
    summary: proposal.summary,
    status: proposal.status,
    sourceStatus: proposal.sourceStatus,
    url: proposal.url,
    authorship: {
      isPrimaryAuthor: author.isPrimaryAuthor,
      sourceAuthorOrder: author.sourceAuthorOrder,
    },
    mandate: author.mandate
      ? {
          id: author.mandate.id,
          legislatureNumber: author.mandate.legislatureNumber,
        }
      : null,
  };
}
export function voteDto(vote: LegislativeVote) {
  const voting = vote.voting;
  const proposal = voting.proposal;
  return {
    id: vote.id,
    position: vote.position,
    sourcePosition: vote.sourcePosition,
    votedAt: vote.votedAt?.toISOString() ?? null,
    voting: {
      id: voting.id,
      source: voting.source,
      dateTime: voting.dateTime.toISOString(),
      description: voting.description,
      result: voting.result,
      sourceResult: voting.sourceResult,
      sourceUrl: voting.sourceUrl,
    },
    proposal: proposal
      ? {
          id: proposal.id,
          type: proposal.type,
          number: proposal.number,
          year: proposal.year,
          summary: proposal.summary,
        }
      : null,
    mandate: vote.mandate
      ? {
          id: vote.mandate.id,
          legislatureNumber: vote.mandate.legislatureNumber,
        }
      : null,
  };
}
export function expenseDto(item: ParliamentaryExpense) {
  return {
    id: item.id,
    source: item.source,
    year: item.year,
    month: item.month,
    categoryCode: item.categoryCode,
    category: item.category,
    supplierName: item.supplierName,
    supplierDocument: item.supplierDocument,
    documentNumber: item.documentNumber,
    documentType: item.documentType,
    documentDate: item.documentDate,
    grossValue: item.grossValue,
    deductionValue: item.deductionValue,
    netValue: item.netValue,
    sourceUrl: item.sourceUrl,
    mandate: item.mandate
      ? {
          id: item.mandate.id,
          legislatureNumber: item.mandate.legislatureNumber,
        }
      : null,
  };
}
