# Close Akash Deployment GitHub Action

This GitHub Action closes a deployment on the Akash Network.

## Usage

```yaml
- name: Close Akash Deployment
  uses: akash-network/akash-gha/packages/close-deployment@main
  with:
    mnemonic: ${{ secrets.AKASH_MNEMONIC }}
    dseq: '12345'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `mnemonic` | Wallet mnemonic phrase for signing transactions | Yes | - |
| `dseq` | Deployment sequence number to close | Yes | - |
| `gas` | Gas limit for transactions | No | `auto` |
| `gas-multiplier` | Gas multiplier (used when gas is "auto") | No | `1.5` |
| `fee` | Fee amount in the smallest denomination | No | - |
| `denom` | Token denomination for fees | No | `uakt` |
| `rest-url` | REST API URL for querying the Akash network | No | `https://rpc.akt.dev/rest` |
| `tx-rpc-url` | RPC URL for submitting transactions | No | `https://rpc.akt.dev/rpc` |

## Outputs

| Output | Description |
|--------|-------------|
| `deployment-id` | The closed deployment ID (owner/dseq) |
| `tx-hash` | The transaction hash of the close deployment transaction |

## Example Workflow

### Close deployment after tests complete

```yaml
name: Cleanup Akash Deployment

on:
  workflow_dispatch:
    inputs:
      dseq:
        description: 'Deployment sequence number to close'
        required: true

jobs:
  close:
    runs-on: ubuntu-latest
    steps:
      - name: Close Deployment
        uses: akash-network/akash-gha/packages/close-deployment@main
        with:
          mnemonic: ${{ secrets.AKASH_MNEMONIC }}
          dseq: ${{ github.event.inputs.dseq }}
```

### Close deployment on PR close

```yaml
name: Cleanup Preview Environment

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Get deployment dseq from comment or artifact
        id: get-dseq
        run: |
          # Your logic to retrieve the dseq
          echo "dseq=12345" >> $GITHUB_OUTPUT

      - name: Close Deployment
        uses: akash-network/akash-gha/packages/close-deployment@main
        with:
          mnemonic: ${{ secrets.AKASH_MNEMONIC }}
          dseq: ${{ steps.get-dseq.outputs.dseq }}
```

## Security Recommendations

1. **Store mnemonic as a secret**: Never commit your mnemonic phrase to the repository. Always use GitHub Secrets.

```yaml
with:
  mnemonic: ${{ secrets.AKASH_MNEMONIC }}
```

2. **Use environment protection**: Consider using GitHub Environments with required reviewers for production deployments.

## Network Configuration

By default, the action connects to the Akash mainnet. You can configure custom endpoints:

```yaml
with:
  mnemonic: ${{ secrets.AKASH_MNEMONIC }}
  dseq: '12345'
  rest-url: 'https://custom-rest.akash.network'
  tx-rpc-url: 'https://custom-rpc.akash.network'
```

## License

Apache-2.0
