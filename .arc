@app
quick-map

@static
prune true

@plugins
enhance/arc-plugin-enhance
enhance/arc-plugin-styles

@tables
sessions
  _idx *
  ttl ttl

zip
  key *

routes
  key *
  ttl ttl

@aws
runtime nodejs22.x
