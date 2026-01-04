Originally created on Ubuntu.

Prerequisites:

- gamedig
- jq (optional, if required)
- node > v24.9.0

# Installation

## gamedig

`$ npm install -g gamedig`

## jq

`$ sudo apt update; sudo apt install jq`

# To query a server:

## Plain JSON

gamedig --type rust --host 185.206.151.10 --port 28015

## Pretty JSON

gamedig --type rust --host 185.206.151.10 --port 28015 --pretty

## Using jq, colorizes output

gamedig --type rust --host 185.206.151.10 --port 28015 --pretty | jq

## Extract certain types of fields from the JSON

gamedig … | jq '.name, .map, .numplayers, .maxplayers'

### References:

https://chatgpt.com/c/687604bc-8048-800f-a6b5-e6bbb980c529
