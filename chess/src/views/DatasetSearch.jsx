import React, { useState } from 'react';
import axios from 'axios';

function DatasetSearch() {
  const [query, setQuery] = useState('');      // user input from the search box
  const [result, setResult] = useState(null); // dataset returned from the API
  const [error, setError] = useState('');     // error message if not found

  const handleSearch = async () => {
    // Break input into letters only and combine into one string
    // This helps normalize inputs like "Data Set 1" -> "dataset"
    const parts = query.toLowerCase().match(/[a-z]+/g) || [];
    const datasetName = parts.join('');

    // If nothing valid was typed, show error
    if (!datasetName) {
      setError('Not Found');
      setResult(null);
      return;
    }

    try {
      // Request dataset info from backend
      const { data } = await axios.get(`/api/datasets/${datasetName}`);
      setResult(data);     // store returned dataset
      setError('');        // clear any previous error
    } catch (e) {
      // If request fails, dataset doesn't exist
      setError('Not Found');
      setResult(null);
    }
  };

  return (
    <div>
      <h2>Search Dataset</h2>

      {/* Input for dataset name */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Dataset name"
      />

      {/* Trigger dataset search */}
      <button onClick={handleSearch}>Search</button>

      {/* Show error message if search fails */}
      {error && <div>{error}</div>}

      {/* Show dataset result if found */}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

export default DatasetSearch;
