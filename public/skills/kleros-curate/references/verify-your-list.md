# Verify Your List
<!-- Sources: live Ethereum Mainnet, Gnosis Chain, and Sepolia deployment state and MetaEvidence; repository LGTCR references -->
<!-- Served by the Curate app: kleros/kleros-skills@45bce8e, with the Gnosis row moved to the list of lists that replaced 0x2418…a0b5 on 17 Nov 2026. -->

Use this file when a user wants a Curate registry deployed on Ethereum Mainnet, Gnosis Chain, or Sepolia to
become visible and verified in the Curate frontend. The verification registries on all three supported
networks are `LightGeneralizedTCR`, so this is a narrow overlay on the standard Light Curate submission
workflow, not a separate contract flavor.

List verification is recommended for public registries. Skip it only when the registry is intentionally
private or stealth.

## Canonical verification registries

| Network | Chain ID | Verification registry | Event scan start block |
|---------|---------:|-----------------------|-----------------------:|
| Ethereum Mainnet | `1` | `0x2aCF59a420cA888f46d46974f62570F8a38Cd4Da` | `25641005` |
| Gnosis Chain | `100` | `0x5F688a4bac5E2787Ef1d9de325831E537eE4CfFa` | `49311754` |
| Sepolia | `11155111` | `0xD965Ce430afE0423Ff19A5eb08F7C5722EFabCaF` | `4049205` |

Select one complete row by chain ID. Never mix an address or scan start block from another row.

Gnosis Chain's former verification registry, `0x2418D887d0d0Fe03b793A6aF4321fa488226A0b5`, was replaced
on 17 Nov 2026. It still accepts submissions onchain, but a registry listed there is not verified in the
Curate frontend: never submit to it. The Classic (`GeneralizedTCR`) lists of lists are retired as well.

Keep these roles distinct throughout the workflow:

- `chainId` — the selected network.
- `verificationRegistryAddress` — the fixed address from the selected row; this is the transaction target.
- `verificationRegistryDeploymentBlock` — the selected row's event scan start block.
- `registryToVerify` — the user's deployed registry on the same selected network; this is a value inside the
  submitted item.json.

The verification target is LGTCR even when `registryToVerify` is a Stake Curate or other policy-eligible
Curate registry. Contract mechanics are determined by the transaction target, so always use the Light Curate
submission path described below.

## Required references

Read these files before preparing a verification submission:

1. `light-curate.md` — LGTCR discovery, submission, simulation, and request lifecycle.
2. `shared-metaevidence.md` — latest applicable registration MetaEvidence and policy retrieval.
3. `shared-item-json.md` — exact-schema item.json construction and validation.
4. `shared-ipfs-upload.md` — single-file paid uploads, CID reuse, and IPFS round-trip verification.
5. `shared-deposits.md` — live LGTCR deposit computation.
6. `shared-abi-fragments.md` — LGTCR read/write signatures and status enum.

Do not cache a MetaEvidence ID, schema, policy, deposit, or item URI in this file. Registry governors can
change them; the latest applicable onchain state is authoritative.

## Standard Light Curate verification flow

1. **Select the network and address roles**:
   - require chain ID `1`, `100`, or `11155111`.
   - load `verificationRegistryAddress` and `verificationRegistryDeploymentBlock` from the same table row.
   - confirm `registryToVerify` is the deployed registry the user wants listed on that same chain, not the
     transaction target.
2. **Verify both addresses on the selected chain**:
   - require non-empty `eth_getCode` for both addresses.
   - confirm `verificationRegistryAddress` exposes the LGTCR hallmark reads from `light-curate.md` and the
     `addItem(string)` interface from `shared-abi-fragments.md`.
   - do not require `registryToVerify` to be LGTCR; determine its type separately and let the live
     verification policy decide whether it is eligible.
3. **Fetch the latest registration MetaEvidence** from `verificationRegistryAddress` using
   `shared-metaevidence.md`. Fetch and read its `fileURI` policy, then extract `metadata.columns` verbatim.
   Do not assume the deployment-time MetaEvidence is still current or that all three networks share a schema.
4. **Check policy compliance and duplicates** for `registryToVerify`. Validate every requirement in the
   selected registry's live policy. When duplicate entries are forbidden, use onchain state:
   - scan `NewItem` logs from `verificationRegistryDeploymentBlock` through `latest` on the selected chain.
   - decode every item ID and item URI, fetch each item JSON, and compare its schema-designated registry
     address to `registryToVerify` after case-insensitive EVM address normalization. The item ID is derived
     from the item URI, so one guessed item ID cannot rule out the same address under another CID.
   - for every address match, call `getItemInfo` and the latest `getRequestInfo` as described in
     `light-curate.md`. Decode LGTCR status using `shared-abi-fragments.md`; do not guess numeric enum values.
     Treat a registered item or unresolved request as an existing or active submission.
   - if an indexer or frontend search is used for convenience, cross-check it against the onchain log scan.
   Stop if compliance or duplicate status cannot be established.
5. **Build item.json** using `shared-item-json.md`:
   - deep-copy the live `metadata.columns` without edits.
   - put `registryToVerify` in the unique field designated by the live schema for the registry address.
   - make `Object.keys(values)` exactly match the column labels and order.
   - stop if the schema does not unambiguously identify where the registry address belongs.
6. **Get approval before the paid upload**. Show the selected chain, both address roles, live policy summary,
   fetched columns, compliance check, duplicate check, and complete item.json. Upload only after approval.
7. **Upload and round-trip item.json** using `shared-ipfs-upload.md`. The upload request must contain only
   this one file. The resulting `/ipfs/<CID>` must fetch back to the approved JSON.
8. **Compute the LGTCR submission value live** using `shared-deposits.md`, then simulate this exact call on
   the selected chain:

   ```text
   chain: chainId
   to: verificationRegistryAddress
   call: LightGeneralizedTCR.addItem("/ipfs/<CID>")
   msg.value: live LGTCR submission value in the selected chain's native token
   ```

9. **Get final onchain approval**. Show the selected chain, both named addresses, item URI, live deposit
   inputs, final `msg.value`, and successful simulation result. Submit only after the user approves.
10. **Verify the receipt and track the request**. Confirm the emitted item data resolves to the approved JSON
    and record the item ID and request state. A successful submission is pending, not yet verified.
11. **Finalize and confirm visibility**. After an unchallenged challenge period, simulate and call
    `executeRequest(itemID)`, then confirm the item is registered onchain. Check the accepted item at
    `https://curate.kleros.io/tcr/<chainId>/<verificationRegistryAddress>` and confirm the listed registry is
    discoverable in the frontend. If onchain state is registered but the UI has not caught up, report frontend
    indexing as pending and do not resubmit. If challenged, follow the LGTCR dispute workflow. Never claim
    verification is complete from the submission receipt alone or invent an indexing ETA.

## Stop conditions

Stop instead of uploading or submitting if:

- the target chain is not Ethereum Mainnet, Gnosis Chain, or Sepolia, or the chain is unclear.
- `verificationRegistryAddress` or its scan start block does not exactly match the selected table row.
- either address is missing, is on a different chain, or has no code on the selected chain.
- the fixed verification target does not behave as `LightGeneralizedTCR`.
- the latest registration MetaEvidence or policy cannot be fetched and parsed.
- `registryToVerify` does not clearly satisfy the live policy.
- an accepted or active duplicate exists, or duplicate status cannot be established when the policy forbids it.
- the live schema is missing or does not unambiguously accept `registryToVerify`.
- item.json validation or its IPFS round trip fails.
- the live deposit cannot be computed or the exact `addItem(string)` simulation fails.
- the user has not approved the paid upload and the final onchain transaction.
