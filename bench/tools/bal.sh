#!/bin/bash
kane-cli balance 2>&1 | grep -o '[0-9.]*$'
