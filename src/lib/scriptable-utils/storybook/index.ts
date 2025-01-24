import { getFontFamily } from '../input/chooseFont/fonts'
import { objectEntries } from '../object'
import { sortByComparison } from '../sort'
import { MapFn } from '../types/utilTypes'
import { Div, getTable, H1, Icon, P, styled } from '../UITable'
import hierarchyData from './hierarchyData'
import { Parent, Preview, SubHierarchy } from './types'

type HierarchyEntry<T = Preview | Parent<any>> = { title: string; val: T }
type ParentHierarchyEntry = HierarchyEntry<Parent<any>>
type PreviewHierarchyEntry = HierarchyEntry<Preview>

//

const EntryContainer = styled.NonCascadingDiv({
  borderTop: 1,
  borderBottom: 1,
  paddingTop: 10,
  paddingBottom: 10,
})

const TitleRow = styled.Div({
  font: getFontFamily({ family: 'System', weight: 600 }),
})

const ParentRow = ({
  title,
  val: parent,
  onSelectChild,
}: HierarchyEntry<Parent<any>> & { onSelectChild: MapFn<SubHierarchy> }) =>
  EntryContainer(
    [
      TitleRow([P(title), Icon('folder', { width: '10%' })]),
      parent.description &&
        Div([P(parent.description, { font: () => Font.footnote() })], {
          height: 14,
        }),
    ],
    {
      onTap: () => onSelectChild(parent.children),
      borderTop: 1,
      borderBottom: 1,
    },
  )

const PreviewRow = ({ title, val: { description, showPreview } }: HierarchyEntry<Preview>) =>
  EntryContainer(
    [
      TitleRow([P(title), Icon('open_external', { width: '10%' })]),
      description && Div([P(description, { font: () => Font.footnote() })], { height: 14 }),
    ],
    { onTap: showPreview, borderTop: 1, borderBottom: 1 },
  )

//

const isParentEntry = (entry: HierarchyEntry): entry is ParentHierarchyEntry => 'children' in entry.val

const sortEntries = sortByComparison({
  getValue: (entry: HierarchyEntry) => entry,
  shouldRaiseA: isParentEntry,
})

const showSubHierarchy = (title: string, subHierarchy: SubHierarchy): Promise<void> => {
  const { present } = getTable({ name: `storybook_${title}` })
  const entries = objectEntries(subHierarchy).map<HierarchyEntry>(([title, val]) => ({
    title,
    val,
  }))
  return present({
    render: () => [
      H1(title),
      Div(
        entries.sort(sortEntries).map((entry) =>
          isParentEntry(entry)
            ? ParentRow({
                ...entry,
                onSelectChild: (child) => showSubHierarchy(entry.title, child),
              })
            : PreviewRow(entry as PreviewHierarchyEntry),
        ),
      ),
    ],
  })
}

//

export default () => showSubHierarchy('Storybook', hierarchyData)
