---
layout: default
title: day 02
---

# Day 2: 1202 Program Alarm 

Hello, festive Rockstar developers. So... if day 1's requirement for arithmetic rounding threw a spanner in the works, day 2 has basically emptied a sack of wrenches into the delicate internal workings. And I cheated and peeked ahead at day 3 and that makes things even, um, wrenchier.

Day 2 is based on a fictional Intcode computer, that uses sequences of data and opcodes that look like this:

`1,9,10,3,2,3,11,0,99,30,40,50`

And in any other language, you'd split the input string on commas to give you an array/list of integers. Except guess 
what two features were notably absent from Rockstar? That's right! String splitting, and arrays. In fact, 
Rockstar didn't have any type of list or array data structure at all... so check out [Adding Arrays to Rockstar](adding_arrays_to_rockstar) for more gory detail than you 
ever wanted about how to parse and allocate arrays in Satriani.

But here's the solution - 1202 Program Alarm in Rockstar.

<a href="/online?source=/advent/day02/intcodes.rock&input=/advent/day02/intcodes.rock.in">Click here to try it online</a> - and note I've already changed the input fields to 12,2 as specified in the challenge.

```$rockstar
{% include_relative intcodes.rock %}
```

### Part 2

<a href="/online?source=/advent/day02/intcodes_part_2.rock&input=/advent/day02/intcodes.rock.in">Click here to try it online</a>

```$rockstar
{% include_relative intcodes_part_2.rock %}
```