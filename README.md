# QuickCalc Tools: a passive-income tools website

A free website of calculators and tools (loan EMI, compound interest, BMI, age, word counter, password generator and more).
It earns money from **Google AdSense ads** and **affiliate links** when people find the tools on Google.
It costs **$0** to run (hosted free on GitHub Pages) and needs almost no maintenance.

## How it makes money

```
Google search -> visitor uses a tool -> sees ads / clicks an affiliate link -> you get paid
```

Be realistic: traffic from Google grows slowly. Expect little or nothing for the first 3-6 months,
then income that grows as pages start ranking. More tools mean more pages that can rank and more income.

## Go-live checklist (about 30 minutes, one time)

1. **Turn on GitHub Pages**: repo **Settings -> Pages -> Source: "GitHub Actions"**.
2. **Merge this branch into `main`.** The site deploys automatically to
   `https://novashiv11.github.io/Project-1/` (the workflow file is in `.github/workflows/deploy.yml`).
3. **Edit `config.json`**: set `site_name`, `contact_email` and (if you use a custom domain) `site_url`.
4. **Get on Google**: add the site to [Google Search Console](https://search.google.com/search-console)
   and submit `sitemap.xml`. This step is what brings visitors.
5. **Apply for [Google AdSense](https://adsense.google.com)** once the site is live.
   When approved, put your ID (looks like `ca-pub-1234567890123456`) in `config.json` -> `adsense_client`
   and push. The ads and `ads.txt` turn on automatically.
   *Tip: AdSense approves custom domains more easily than `github.io` addresses. A `.com` domain costs about $10 a year.*
6. **Optional affiliate income**: join Amazon Associates, or a bank/broker affiliate program
   (these pay well next to finance calculators), then put your links in `config.json` -> `affiliate_links`.

## Adding a new tool (the way to grow income)

Copy any file in `tools/`, change the meta block (`slug`, `title`, `description`, `faq`), the tool HTML/JS and the article text, then push.
The home page, sitemap and SEO tags update automatically. Ideas that get lots of searches: GPA calculator,
mortgage affordability, salary to hourly, retirement savings, date difference, unit converter, calorie calculator, SIP calculator.

## Build locally

```bash
python3 build.py                      # writes the site to _site/
python3 -m http.server -d _site 8000  # preview at http://localhost:8000
```

No dependencies besides Python 3.
