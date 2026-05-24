function envelope({ results, total, page = 0, perPage = results.length }) {
  return {
    metadata: {
      total,
      page,
      per_page: perPage,
    },
    results,
  };
}

module.exports = { envelope };
