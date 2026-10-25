#!/bin/sh
# 三层进程树 fixture：leader exec 成 sleep，后台子 shell 再派生 sleep。
# 用于验证进程组击杀无残留。
sh -c 'sleep 600 & sleep 600' &
exec sleep 600
