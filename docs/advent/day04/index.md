---
layout: default
title: day 02
---

# Day 4: Secure Container

Here's the solution to part 2 in idiomatic Rockstar - [run it online](/online?source=/advent/day04/secure_container_2_idiomatic.rock&input=/advent/day04/secure_container.rock.in). *(Be patient - we're scanning nearly half a million six-digit numbers, coercing them into strings and then back into digits, in an esoteric joke language whose interpeter is written in JavaScript... it'll take 20-30 seconds to complete.)*

I've also got solutions in minimalist Rockstar to [part 1](/online?source=/advent/day04/secure_container.rock&input=/advent/day04/secure_container.rock.in) and [part 2](/online?source=/advent/day04/secure_container_2_minimalist.rock&input=/advent/day04/secure_container.rock.in).

```
{% include_relative secure_container_2_idiomatic.rock %}
```

## Lars-Erik Aabech's solution

Somebody else beat me to the punch on this one - [Lars-Erik Aabech](https://twitter.com/bleedo/status/1202751102107697153) had a working implementation long before I did. Here's his solution - [run it online](/online?source=/advent/day04/lars-erik.rock) - note that it'll take about 7-8 seconds to complete in the Rockstar online interpreter.

```$rockstar
{% include_relative lars-erik.rock %}
```

I particularly liked how the puzzle inputs here are initialised within the program using poetic literals:
```
Hell is a purgatory for beaten power o
The World is broken lust sleepless dreams of screaming
```

