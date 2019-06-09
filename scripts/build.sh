#!/usr/bin/env bash

cargo build --release
docker build -t org-search .