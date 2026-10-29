# Silo V2 interest-rate models on Sonic

This original ATQ module retrieves every model-version-2 rate-model contract address from
the `InterestRateModelConfig` entities of Silo Finance's documented legacy V2
Sonic subgraph. The source field named `config` contains the interest-rate-model address. These
are rate-model clones, separate from their parameter-storage contracts and
lending configurations.

## Specific source documentation

Silo Finance's [snapshot documentation](https://github.com/silo-finance/lenders-snapshot/blob/58dbfc612906307137c305d56adf9f1a7ea61dce/scripts/lender-snapshot/README.md)
identifies the [snapshot configuration](https://github.com/silo-finance/lenders-snapshot/blob/58dbfc612906307137c305d56adf9f1a7ea61dce/scripts/lender-snapshot/snapshot_lenders.py),
which specifically names Sonic subgraph `8wcbzcdNirQvk1ETh25wpVzb5GWs8DvugpbwrYnTCcxj`.
The [project borrower tooling](https://github.com/silo-finance/actions/blob/0e0a4f79772a176846e181483d1f22adf5b26948/scripts/pull_borrowers/fetch_legacy_borrowers.py)
also identifies this source as legacy V2. Authorization for other publications
by the same publisher is not inferred.

That named source resolved on 2026-10-29 to
`QmQUcPAEpUQJL3AYK21hsgNnj6XmWepTXJXySHdFXMmp7p`. The module queries the
explicit deployment using only the supplied key in the authorization header.
The [factory implementation](https://github.com/silo-finance/silo-contracts-v2/blob/3db357d671e7fd3a6e591834e1d5b5054e950bb0/silo-core/contracts/interestRateModel/InterestRateModelV2Factory.sol)
explains the configuration hash, configuration-contract deployment and cloned
rate-model association. The [configuration contract](https://github.com/silo-finance/silo-contracts-v2/blob/3db357d671e7fd3a6e591834e1d5b5054e950bb0/silo-core/contracts/interestRateModel/InterestRateModelV2Config.sol)
exposes the immutable parameters through `getConfig()`. The deployment manifest
identifies its Sonic factory and the rate-model ABI. Recheck the named source
before filing.

## Retrieval and naming

Source entity IDs are 32-byte configuration hashes, rather than contract
addresses. Pagination uses those actual unique Bytes IDs, with an unfiltered
first page, a fixed block hash and a final metadata seal. Output addresses come
from the separate `config` address field. The deployed factory maps each source
hash to that rate-model clone. Its `irmConfig()` points to a different contract
whose parameters hash to the source identifier. Every row is retained; malformed
identities, unsupported model versions, duplicate output addresses, source
errors or unfinished pagination throw instead of returning partial output.

Names identify the Silo V2 interest-rate model and its source configuration hash.
Long names use an ellipsis; a name collision uses the full contract address.
No sequential instance number is invented. Notes identify the interest-rate calculation role, model version and complete
configuration identifier. Only
these required source fields are requested.

## Build

Use Yarn for dependency installation, then `yarn build`. All logic is in
`src/main.mts`; it exports only the asynchronous two-argument `returnTags`.
The module was authored from scratch and is MIT licensed.
