import math

# 1. math.sumprod() - Sum of products
p = [1, 2, 3]
q = [4, 5, 6]
# (1*4) + (2*5) + (3*6) = 4 + 10 + 18 = 32
result = math.sumprod(p, q)
print(f"math.sumprod({p}, {q}) = {result}")

# 2. ceil/floor/trunc now support inf and nan
inf = math.inf
nan = math.nan

print(f"math.ceil(inf) = {math.ceil(inf)}")
print(f"math.floor(nan) = {math.floor(nan)}")

# 3. pow() behavior changes for edge cases (inf/nan)
# pow(-0.0, -inf) now returns inf
print(f"math.pow(-0.0, -inf) = {math.pow(-0.0, -math.inf)}")
