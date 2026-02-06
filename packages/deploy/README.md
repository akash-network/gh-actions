# Deploy on Akash Network GitHub Action

A GitHub Action to deploy applications on the [Akash Network](https://akash.network/) using the Chain SDK.

## Features

- Deploy applications using SDL (Stack Definition Language)
- Filter bids using MongoDB-style queries with [@ucast/mongo2js](https://github.com/stalniy/ucast) or use `cheapest` for automatic selection
- Configurable gas and fee settings
- Automatic bid selection and lease creation
- Support for both inline SDL and file-based SDL

## Usage

```yaml
name: Deploy to Akash

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Akash Network
        uses: akash-network/akash-gha/packages/deploy-using-akash@main
        with:
          mnemonic: ${{ secrets.AKASH_MNEMONIC }}
          bid-filter: 'cheapest'
          sdl: ./deploy.yaml
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `mnemonic` | Wallet mnemonic phrase for signing transactions | Yes | - |
| `bid-filter` | Filter for selecting a bid (use `cheapest` or MongoDB-style filter) | Yes | - |
| `sdl` | Path to SDL file or inline SDL string | Yes | - |
| `gas` | Gas limit for transactions | No | `auto` |
| `gas-multiplier` | Gas multiplier (used when gas is "auto") | No | `1.5` |
| `fee` | Fee amount in smallest denomination | No | - |
| `denom` | Token denomination for fees and deposit | No | `uakt` |
| `deposit` | Deposit amount for deployment in uakt | No | `500000` |
| `rest-url` | REST API URL for querying Akash network | No | `https://rpc.akt.dev/rest` |
| `tx-rpc-url` | RPC URL for submitting transactions | No | `https://rpc.akt.dev/rpc` |
| `lease-timeout` | Maximum time to wait for bids (seconds) | No | `180` |

## Outputs

| Output | Description |
|--------|-------------|
| `deployment-id` | The deployment ID (owner/dseq) |
| `dseq` | The deployment sequence number |
| `lease-id` | The lease ID (owner/dseq/gseq/oseq/provider) |
| `provider` | The selected provider address |
| `lease-status` | The status of the lease |

## Bid Filter

The `bid-filter` input supports two modes:

### 1. Cheapest Bid Selection

Use `cheapest` to automatically select the lowest priced bid:

```yaml
bid-filter: 'cheapest'
```

### 2. MongoDB-style Filter

Use [@ucast/mongo2js](https://github.com/stalniy/ucast) syntax to filter bids based on their properties. The filter is applied to bid objects with the following structure:

```typescript
{
  id: {
    owner: string;      // Deployment owner address
    dseq: string;       // Deployment sequence number
    gseq: number;       // Group sequence number
    oseq: number;       // Order sequence number
    provider: string;   // Provider address
    bseq: number;       // Bid sequence number
  };
  price: {
    denom: string;      // Token denomination
    amount: string;     // Price amount
  };
  state: string;        // Bid state
}
```

### Filter Examples

**Select by specific provider:**
```yaml
bid-filter: '{ "id.provider": "akash1abc123..." }'
```

**Filter by maximum price:**
```yaml
bid-filter: '{ "price.amount": { "$lte": "1000" } }'
```

**Filter by price range:**
```yaml
bid-filter: |
  {
    "$and": [
      { "price.amount": { "$gte": "500" } },
      { "price.amount": { "$lte": "1500" } }
    ]
  }
```

### Supported Operators

The filter supports standard MongoDB query operators:

- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`
- Logical: `$and`, `$or`, `$not`, `$nor`
- Element: `$exists`
- Evaluation: `$regex`

## SDL Configuration

You can provide SDL in two ways:

### File-based SDL

Create an SDL file in your repository and reference it:

```yaml
sdl: ./deploy.yaml
```

### Inline SDL

Provide SDL directly in the workflow:

```yaml
sdl: |
  version: "2.0"
  services:
    web:
      image: nginx:latest
      expose:
        - port: 80
          as: 80
          to:
            - global: true
  profiles:
    compute:
      web:
        resources:
          cpu:
            units: 0.5
          memory:
            size: 512Mi
          storage:
            size: 512Mi
    placement:
      dcloud:
        pricing:
          web:
            denom: uakt
            amount: 10000
  deployment:
    web:
      dcloud:
        profile: web
        count: 1
```

## Complete Example

```yaml
name: Deploy to Akash

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Akash Network
        id: deploy
        uses: akash-network/akash-gha/packages/deploy-using-akash@main
        with:
          mnemonic: ${{ secrets.AKASH_MNEMONIC }}
          bid-filter: 'cheapest'
          sdl: ./akash/deploy.yaml
          deposit: '1000000'
          lease-timeout: '300'

      - name: Print deployment info
        run: |
          echo "Deployment ID: ${{ steps.deploy.outputs.deployment-id }}"
          echo "DSEQ: ${{ steps.deploy.outputs.dseq }}"
          echo "Lease ID: ${{ steps.deploy.outputs.lease-id }}"
          echo "Provider: ${{ steps.deploy.outputs.provider }}"
```

## Security

**Important:** Always store your mnemonic as a GitHub secret. Never commit mnemonics or private keys to your repository.

```yaml
# Good - using secrets
mnemonic: ${{ secrets.AKASH_MNEMONIC }}

# Bad - hardcoded mnemonic (NEVER DO THIS)
mnemonic: "word1 word2 word3..."
```

## Network Configuration

The action uses the default Akash mainnet endpoints:

```yaml
rest-url: 'https://rpc.akt.dev/rest'
tx-rpc-url: 'https://rpc.akt.dev/rpc'
```

You can override these to use different networks or custom endpoints.

## License

Apache-2.0
