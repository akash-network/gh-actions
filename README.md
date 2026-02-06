# Akash Network GitHub Actions

A collection of GitHub Actions for deploying and managing applications on the [Akash Network](https://akash.network/).

## Available Actions

| Action | Description |
|--------|-------------|
| [deploy](./packages/deploy) | Deploy applications to Akash Network |
| [close-deployment](./packages/close-deployment) | Close an existing Akash deployment |

## Quick Start

### Deploy an Application

```yaml
- name: Deploy to Akash
  id: deploy
  uses: akash-network/akash-gha/packages/deploy@deploy/v0.2.0
  with:
    mnemonic: ${{ secrets.AKASH_MNEMONIC }}
    sdl: ./deploy.yaml
    # Optional: filter bids and pick strategy
    # bid-filter: '{ "price.amount": { "$lte": "2000" } }'
    # pick-bid-strategy: 'cheapest'  # or 'first'
```

### Close a Deployment

```yaml
- name: Close Akash Deployment
  uses: akash-network/akash-gha/packages/close-deployment@close-deployment/v0.1.0
  with:
    mnemonic: ${{ secrets.AKASH_MNEMONIC }}
    dseq: ${{ steps.deploy.outputs.dseq }}
```

## Full Workflow Example

Deploy on push to main, close when PR is merged:

```yaml
name: Akash Deployment

on:
  push:
    branches: [main]
  pull_request:
    types: [closed]

jobs:
  deploy:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Deploy to Akash
        id: deploy
        uses: akash-network/akash-gha/packages/deploy@deploy/v0.2.0
        with:
          mnemonic: ${{ secrets.AKASH_MNEMONIC }}
          pick-bid-strategy: 'cheapest'
          sdl: |
            version: "2.0"
            services:
              web:
                image: nginx:alpine
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

      - name: Trigger some work in container or wait for it to do it
        run: |
          echo "Deployed: ${{ steps.deploy.outputs.deployment-id }}"
          echo "DSEQ: ${{ steps.deploy.outputs.dseq }}"

      - name: Close deployment
        uses: akash-network/akash-gha/packages/close-deployment@close-deployment/v0.1.0
        with:
          mnemonic: ${{ secrets.AKASH_MNEMONIC }}
          dseq: ${{ steps.deploy.outputs.dseq }}
```

## Security

**Important:** Always store your wallet mnemonic as a GitHub secret. Never commit mnemonics or private keys to your repository.

```yaml
# Correct - using GitHub secrets
mnemonic: ${{ secrets.AKASH_MNEMONIC }}

# NEVER do this
mnemonic: "your mnemonic words here"
```

## Documentation

- [Deploy Action](./packages/deploy/README.md) - Full documentation for the deploy action
- [Close Deployment Action](./packages/close-deployment/README.md) - Full documentation for closing deployments
- [Akash SDL Documentation](https://akash.network/docs/getting-started/stack-definition-language/) - Learn about SDL syntax

## Requirements

- An Akash wallet with sufficient AKT for deployment deposits and transaction fees
- GitHub repository with secrets configured

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

Apache-2.0
