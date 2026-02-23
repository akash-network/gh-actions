# Akash Network GitHub Actions

A collection of GitHub Actions for deploying and managing applications on the [Akash Network](https://akash.network/).

## Available Actions

| Action | Description |
|--------|-------------|
| [deploy](./packages/deploy) | Deploy applications to Akash Network |
| [close-deployment](./packages/close-deployment) | Close existing Akash deployments based on filter |

## Quick Start

### Deploy an Application

```yaml
- name: Deploy to Akash
  id: deploy
  uses: akash-network/akash-gha/packages/deploy@deploy/v0.4.0
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
  uses: akash-network/akash-gha/packages/close-deployment@close-deployment/v0.2.1
  with:
    mnemonic: ${{ secrets.AKASH_MNEMONIC }}
    filter: |
      dseq: ${{ steps.deploy.outputs.dseq }}
```

## Full Workflow Example

Check the full workflow example in [.github/workflows/example.yml](.github/workflows/example.yml)

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
