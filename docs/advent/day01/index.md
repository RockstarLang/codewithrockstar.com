---
layout: default
title: day 01
---

# Advent of Code 2019: Day 1

See the problem description [here](https://adventofcode.com/2019/day/1)

So... confession time. I've actually had to change the Rockstar language to make this possible, because 
trying to solve this puzzle exposed the fact that Rockstar had no
notion of arithmetic rounding. (Hey, this is what happens when you invent programming languages in bars.)
And while I'm sure there's some way to round numbers down using only the language capabilities that already existed, I decided to add the `turn` keyword to the language spec.
 
### Solution to part 1

<a href="/online?source=/advent/day01/fuel.rock&input=/advent/day01/fuel.rock.in">try it online</a>
```
{% include_relative fuel.rock %}
```

### What's going on here?

`The river is ice` (initialises `the river` = 3)  
`The child is gone` (initialise the accumulator = 0)  
`The night is drawing near` (the night = 74)  
`Fear is distant so` (fear = 72)  
`Let darkness be the night without fear` (the darkness = 74 - 72 = 2)  
  
`Listen to the fire` (read next line into `the fire`)  
`Until the fire is empty` (loop until `the_fire` is equal to `empty` (""/null/undefined))  
`Let the light be the fire over the river` (`the light` = `the fire` / 3)  
`Turn down the light` (round down to the nearest integer)  
`Let the light be without darkness` (subtract two)  
`Let the child be with the light` (add to the accumulator)  
`Listen to the fire` (read the next line)  
    (blank link marks end of `until` loop)  
`Whisper the child` (output result)   

### Solution to part 2

<a href="/online?source=/advent/day01/tyranny.rock&input=/advent/day01/fuel.rock.in">try it online</a>

```
{% include_relative tyranny.rock %}
```

No commentary for part 2 of each solution. You'll have to figure them out for yourself. :)
