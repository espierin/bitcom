# BITCom section - Craft CMS implementation brief

## Design fit

The sample pages use the current EFI Craft design vocabulary: Montserrat, EFI primary blue (`#064A89`), coral action colour (`#DE5757`), a full-width blue title band, breadcrumbs, wide containers and alternating white/soft-grey content sections. The static `efi-craft-prototype.css` is a visual prototype only. In Craft, use the existing global layout, header, footer, button component, breadcrumb partial and Tailwind utilities rather than importing this stylesheet.

## Section and entry types

Create a single structure section named **BITCom** with the URI prefix `efi-committees/bioinformatics-it-committee/`. Use the existing committee landing page as the canonical root entry; retain its current URL.

Suggested entries:

1. Overview
2. Committee members
3. Data standards
4. Training and events
5. Digital infrastructure
6. Activity overview
7. Join BITCom
8. Resources

Each entry needs: title, short introduction, content blocks, optional related links, SEO description, review date and content owner.

## Reusable Matrix blocks

- **Text with aside**: rich text plus a labelled note/callout.
- **Three-column cards**: eyebrow, heading, summary and internal/external link.
- **Resource card**: title, publisher, classification, publication date, review date, URL and access label.
- **Timeline item**: date or period, title, public summary, canonical source URL.
- **Profile card**: member relation, portrait asset, role, affiliation, short biography and ORCID URL.

## Member model

Create a `committeeMember` entry type or a global People section. Required fields are `fullName`, `country`, `affiliation`, `role`, `shortBiography`, `portrait`, `orcid`, `institutionalProfile`, `status`, `publishedFrom`, `publishedUntil` and `confirmationDate`.

Do not make ORCID a free-text field. Store the validated 16-character identifier and render it as `https://orcid.org/{id}`. Permit publication only after the member has confirmed identity, affiliation, portrait and ORCID. Keep this confirmation in a non-public administrative field.

## Data and editorial governance

- The EFI committee page remains the authority for current membership and Chair designation.
- Published EFI pages, newsletters and event pages are the authority for public activity claims.
- The BITCom Procedure Manual is the authority for remit, structure and process. It should not be exposed publicly unless EFI approves it for publication.
- An editor must not create a vacancy, appointment date, vendor claim, standard or deliverable from a draft or meeting note.
- Use an entry review date: quarterly for resources and activity, on every membership change for people, and before/after each EFI conference for event content.

## Migration sequence

1. Build the entry types and Matrix blocks in a Craft staging environment.
2. Create the eight entries and migrate the approved text from these samples.
3. Create the eight person records and obtain individual confirmation.
4. Replace every prototype relative link with the Craft entry relation or final URI.
5. Add the BITCom subnavigation to the existing EFI committee navigation pattern.
6. Verify accessibility, mobile layout, external-link behaviour and member-only access rules for teaching materials.
7. Ask EFI Office and the BITCom Chair for final content approval before production deployment.
