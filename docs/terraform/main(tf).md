# Table of Contents
- [Table of Contents](#table-of-contents)
- [Terraform](#terraform)
- [Terraform for AWS](#terraform-for-aws)
  - [Structure](#structure)
  - [Variables](#variables)
    - [Variables within Child Modules](#variables-within-child-modules)
  - [Outputs](#outputs)
    - [Outputs within Child Modules](#outputs-within-child-modules)
- [Terminal](#terminal)
  - [Alias](#alias)
- [Random Gotchas](#random-gotchas)
  - [Move State (aka., for a specific resource)](#move-state-aka-for-a-specific-resource)


# Terraform 
Terraform offers a lot of great resources on their website which covers [installation, building and destroying infrastructure](https://developer.hashicorp.com/tutorials/library?product=terraform). 

Below, you'll find resources that helped me get started or common gotchas along the way. 

# Terraform for AWS
Here's the direct link to the [AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs) documentation. 

## Structure

## Variables 

### Variables within Child Modules

## Outputs

### Outputs within Child Modules

# Terminal
Some of the best things about coding come when you have the ability to customize your dev environment. 

## Alias 
`terraform plan | apply | destroy` = `tf p | a | d`

# Random Gotchas
## Move State (aka., for a specific resource)
Today, I decided to refactor my folder structure by deployment instead of 'service'. So originally, I had all of my S3 service configured in `/modues/s3/`, but now I wanted them to be in `/modules/whateverdeployment/`. I rebuilt everything thing and hit the `terraform plan` with all of my buckets flagged for delete! 
Terraform doesn't know that it changed because programmatically, it's listed as `module.s3.aws_s3_bucket.my_bucket_name` and the new resource is `module.my_deployment.aws_s3_bucket.my_bucket_name`... did you see that "s3" is now "my_deployment". That's what we are fixing here. 

Use the move command to migrate the state to the new module. 

```YAML
terraform state mv module.s3.aws_s3_bucket.my_bucketname module.my_deployment.aws_s3_bucket.my_bucket
```