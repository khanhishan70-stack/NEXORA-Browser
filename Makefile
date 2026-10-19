.PHONY: test

test:
	node --check app.js
	node --test smoke.test.mjs
