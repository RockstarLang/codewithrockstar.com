---
layout: default
title: "Advent of Rockstar: Day 6"
---

# Day 6: Universal Orbit Map

## Part 1

Run it online: [minimalist](/online?source=/advent/day06/universal-orbit-map-part-1-minimalist.rock&input=/advent/day06/universal-orbit-map.rock.in) and [idiomatic](/online?source=/advent/day06/universal-orbit-map-part-1-idiomatic.rock&input=/advent/day06/universal-orbit-map.rock.in) versions.

**This solution requires Firefox** - running it on Chrome is likely to crash  with `RangeError: Maximum call stack size exceeded`. Satriani uses recursion internally for parsing and interpreting arithmetic expressions, and the Rockstar solution to Day 6 uses recursion internally, and neither of them is particularly well optimized, so... yeah. [Just use Firefox.](https://www.mozilla.org/en-GB/firefox/new/)

```
{% include_relative universal-orbit-map-part-1-idiomatic.rock %}
```



